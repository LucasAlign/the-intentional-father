import { useState, useEffect, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { apiFetch } from "../lib/apiFetch";

// ── Palette (matches Home.tsx) ────────────────────────────────────────────────
const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272", parchmentLow: "#6E664C",
  brass: "#D8AA3E", brassSoft: "#C89A34", brassDeep: "#9A7420", brassGlow: "rgba(216,170,62,0.55)",
  walnut: "#5A3A20", walnutMid: "#7A4E2C", walnutLite: "#9C6840",
  ink: "#0C0E07",
  green: "#8AB46A", blue: "#6AAEC8", amber: "#C89840", red: "#C87060",
};
const F = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif";

const glass: CSSProperties = {
  position: "relative", overflow: "hidden", borderRadius: 18,
  background: "linear-gradient(158deg, rgba(46,40,26,0.72) 0%, rgba(24,22,13,0.82) 100%)",
  border: "1px solid rgba(210,190,130,0.16)",
  boxShadow: "0 6px 22px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,240,200,0.06), inset 0 -10px 30px rgba(0,0,0,0.25)",
  backdropFilter: "blur(3px)",
};

const API = "/api";

// #133 — the account/status shapes below are kept in sync by hand with
// routes/admin.ts's own types (AdminAccount, plus lib/billing.ts's
// SubscriptionStatus) rather than shared through api-zod, matching how this
// page has always been a small, separate mini-app from the main Home.tsx
// bundle.
type AccountStatus = "trialing" | "active" | "past_due" | "canceled" | "grandfathered" | "admin" | "pending";

interface AdminAccount {
  userId: string;
  email: string | null;
  status: AccountStatus;
  inviteId: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  providerCustomerId: string | null;
  createdAt: string;
}

interface AccountsSummary {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  grandfathered: number;
}

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: "Pending",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past Due",
  canceled: "Canceled",
  grandfathered: "Grandfathered",
  admin: "Admin",
};

const STATUS_COLOR: Record<AccountStatus, string> = {
  pending: C.parchmentLow,
  trialing: C.blue,
  active: C.green,
  past_due: C.amber,
  canceled: C.red,
  grandfathered: C.parchmentMid,
  admin: C.brass,
};

const FILTER_TABS: Array<AccountStatus | "all"> = ["all", "pending", "trialing", "active", "past_due", "canceled", "grandfathered", "admin"];

function accountDateLabel(a: AdminAccount): string {
  if (a.provider === "manual") return "Comped";
  if (a.status === "trialing" && a.trialEndsAt) return `Trial ends ${new Date(a.trialEndsAt).toLocaleDateString()}`;
  if ((a.status === "active" || a.status === "past_due") && a.currentPeriodEnd) {
    return `${a.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Date(a.currentPeriodEnd).toLocaleDateString()}`;
  }
  if (a.status === "grandfathered") return "Pre-billing beta user";
  if (a.status === "admin") return "Admin account";
  if (a.status === "pending") return "Awaiting approval";
  return `Joined ${new Date(a.createdAt).toLocaleDateString()}`;
}

export default function Admin() {
  const { isLoading, isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AccountStatus | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    setLoadingAccounts(true);
    apiFetch(`${API}/admin/accounts`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { accounts?: AdminAccount[]; summary?: AccountsSummary } | null) => {
        setAccounts(Array.isArray(d?.accounts) ? d.accounts : []);
        setSummary(d?.summary ?? null);
      })
      .catch(() => { setAccounts([]); setSummary(null); })
      .finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setCheckingAccess(false); return; }
    apiFetch(`${API}/admin/is-admin`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((d: { isAdmin?: boolean }) => {
        setHasAccess(!!d.isAdmin);
        if (d.isAdmin) refresh();
      })
      .catch(() => setHasAccess(false))
      .finally(() => setCheckingAccess(false));
  }, [isAuthenticated, refresh]);

  async function approve(account: AdminAccount) {
    if (!account.inviteId) return;
    setBusyId(account.userId);
    try {
      const r = await apiFetch(`${API}/admin/beta-invites/${account.inviteId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }),
      });
      if (r.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function comp(account: AdminAccount) {
    setBusyId(account.userId);
    try {
      const r = await apiFetch(`${API}/admin/accounts/${account.userId}/comp`, { method: "POST" });
      if (r.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function uncomp(account: AdminAccount) {
    setBusyId(account.userId);
    try {
      const r = await apiFetch(`${API}/admin/accounts/${account.userId}/uncomp`, { method: "POST" });
      if (r.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    return accounts
      .filter((a) => filter === "all" || a.status === filter)
      .filter((a) => !search.trim() || (a.email ?? "").toLowerCase().includes(search.trim().toLowerCase()));
  }, [accounts, filter, search]);

  if (isLoading || checkingAccess) {
    return <Shell><div style={S.msg}>Loading…</div></Shell>;
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <div style={S.msg}>Sign in to continue.</div>
        <button style={S.button} onClick={() => login()}>Sign in</button>
      </Shell>
    );
  }

  if (!hasAccess) {
    return (
      <Shell>
        <div style={S.msg}>You don't have access to this page.</div>
        <button style={S.linkButton} onClick={() => setLocation("/")}>← Back</button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={S.headerRow}>
        <h1 style={S.title}>Accounts</h1>
        <button style={S.linkButton} onClick={() => setLocation("/")}>← Back</button>
      </div>

      {/* #133 — a glance, not a revenue dashboard; Stripe's own reporting
          stays authoritative for anything beyond these counts. */}
      {summary && (
        <div style={S.statRow}>
          <div style={S.stat}><div style={S.statNum}>{summary.total}</div><div style={S.statLabel}>Total</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: C.green }}>{summary.active}</div><div style={S.statLabel}>Active</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: C.blue }}>{summary.trialing}</div><div style={S.statLabel}>Trialing</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: C.amber }}>{summary.pastDue}</div><div style={S.statLabel}>Past Due</div></div>
          <div style={S.stat}><div style={S.statNum}>{summary.grandfathered}</div><div style={S.statLabel}>Grandfathered</div></div>
        </div>
      )}

      <input
        style={S.search}
        type="text"
        placeholder="Search by email…"
        aria-label="Search accounts by email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={S.filterRow}>
        {FILTER_TABS.map((f) => (
          <button
            key={f}
            style={{ ...S.filterChip, ...(filter === f ? S.filterChipOn : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <section style={S.section}>
        {loadingAccounts ? (
          <div style={S.msg}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>No accounts match.</div>
        ) : (
          filtered.map((a) => (
            <div key={a.userId} style={S.row}>
              <div style={S.rowMain}>
                <div style={S.rowTop}>
                  <div style={S.email}>{a.email ?? "(no email)"}</div>
                  <span style={{ ...S.badge, color: STATUS_COLOR[a.status], borderColor: STATUS_COLOR[a.status] }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
                <div style={S.meta}>
                  {accountDateLabel(a)}
                  {a.provider === "stripe" && a.providerCustomerId && (
                    <>
                      {" · "}
                      <a
                        style={S.stripeLink}
                        href={`https://dashboard.stripe.com/customers/${a.providerCustomerId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View in Stripe →
                      </a>
                    </>
                  )}
                </div>
              </div>
              {a.status === "pending" && a.inviteId && (
                <button style={S.button} disabled={busyId === a.userId} onClick={() => approve(a)}>
                  {busyId === a.userId ? "…" : "Approve"}
                </button>
              )}
              {a.provider === "manual" ? (
                <button style={S.revokeButton} disabled={busyId === a.userId} onClick={() => uncomp(a)}>
                  {busyId === a.userId ? "…" : "Remove Comp"}
                </button>
              ) : a.status !== "admin" && a.status !== "pending" ? (
                <button style={S.revokeButton} disabled={busyId === a.userId} onClick={() => comp(a)}>
                  {busyId === a.userId ? "…" : "Comp"}
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.root}>
      <div style={S.container}>{children}</div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: {
    minHeight: "100vh", background: `linear-gradient(135deg, ${C.ink} 0%, #1a1410 50%, ${C.ink} 100%)`,
    fontFamily: F, color: C.parchmentMid, display: "flex", justifyContent: "center", padding: "32px 16px",
  },
  container: { width: "100%", maxWidth: 560 },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, color: C.parchment, margin: 0 },
  msg: { color: C.parchmentDim, padding: "24px 4px" },
  statRow: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  stat: { ...glass, flex: "1 1 90px", padding: "10px 8px", textAlign: "center" },
  statNum: { fontSize: 20, fontWeight: 700, color: C.parchment },
  statLabel: { fontSize: 11, color: C.parchmentLow, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },
  search: {
    width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(210,190,130,0.18)",
    borderRadius: 10, padding: "10px 12px", color: C.parchment, fontSize: 14, marginBottom: 12, fontFamily: F,
  },
  filterRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 },
  filterChip: {
    background: "transparent", color: C.parchmentDim, border: "1px solid rgba(210,190,130,0.2)",
    borderRadius: 20, padding: "5px 12px", fontSize: 12.5, whiteSpace: "nowrap",
  },
  filterChipOn: { borderColor: C.brass, color: C.brass },
  section: { ...glass, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", color: C.brassSoft, marginBottom: 10 },
  empty: { color: C.parchmentLow, fontSize: 14, padding: "4px 0" },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    padding: "10px 0", borderTop: `1px solid rgba(210,190,130,0.1)`,
  },
  rowMain: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 },
  rowTop: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  email: { color: C.parchment, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: {
    fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700,
    border: "1px solid", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
  },
  meta: { color: C.parchmentLow, fontSize: 12 },
  stripeLink: { color: C.blue, textDecoration: "none" },
  button: {
    background: C.brassSoft, color: C.ink, border: "none", borderRadius: 10,
    padding: "8px 14px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
  },
  revokeButton: {
    background: "transparent", color: C.parchmentLow, border: `1px solid rgba(210,190,130,0.25)`,
    borderRadius: 10, padding: "8px 14px", fontSize: 14, whiteSpace: "nowrap", flexShrink: 0,
  },
  linkButton: { background: "transparent", color: C.parchmentDim, border: "none", fontSize: 14 },
};
