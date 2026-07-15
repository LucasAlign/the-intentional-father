import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";

// ── Palette (matches Home.tsx) ────────────────────────────────────────────────
const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272", parchmentLow: "#6E664C",
  brass: "#D8AA3E", brassSoft: "#C89A34", brassDeep: "#9A7420", brassGlow: "rgba(216,170,62,0.55)",
  walnut: "#5A3A20", walnutMid: "#7A4E2C", walnutLite: "#9C6840",
  ink: "#0C0E07",
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

interface BetaInvite {
  id: number;
  email: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export default function Admin() {
  const { isLoading, isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [invites, setInvites] = useState<BetaInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoadingInvites(true);
    fetch(`${API}/admin/beta-invites`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setInvites(Array.isArray(rows) ? rows : []))
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setCheckingAccess(false); return; }
    fetch(`${API}/admin/is-admin`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((d: { isAdmin?: boolean }) => {
        setHasAccess(!!d.isAdmin);
        if (d.isAdmin) refresh();
      })
      .catch(() => setHasAccess(false))
      .finally(() => setCheckingAccess(false));
  }, [isAuthenticated, refresh]);

  async function setStatus(invite: BetaInvite, status: "active" | "pending") {
    setBusyId(invite.id);
    try {
      const r = await fetch(`${API}/admin/beta-invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (r.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

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

  const pending = invites.filter((i) => i.status !== "active");
  const active = invites.filter((i) => i.status === "active");

  return (
    <Shell>
      <div style={S.headerRow}>
        <h1 style={S.title}>Sign-ups</h1>
        <button style={S.linkButton} onClick={() => setLocation("/")}>← Back</button>
      </div>

      {loadingInvites ? (
        <div style={S.msg}>Loading…</div>
      ) : invites.length === 0 ? (
        <div style={S.msg}>No sign-ups yet.</div>
      ) : (
        <>
          <section style={S.section}>
            <div style={S.sectionTitle}>Pending ({pending.length})</div>
            {pending.length === 0 && <div style={S.empty}>Nobody's waiting.</div>}
            {pending.map((invite) => (
              <div key={invite.id} style={S.row}>
                <div style={S.rowMain}>
                  <div style={S.email}>{invite.email}</div>
                  <div style={S.meta}>Requested {new Date(invite.invitedAt).toLocaleDateString()}</div>
                </div>
                <button
                  style={S.button}
                  disabled={busyId === invite.id}
                  onClick={() => setStatus(invite, "active")}
                >
                  {busyId === invite.id ? "…" : "Approve"}
                </button>
              </div>
            ))}
          </section>

          <section style={S.section}>
            <div style={S.sectionTitle}>Active ({active.length})</div>
            {active.map((invite) => (
              <div key={invite.id} style={S.row}>
                <div style={S.rowMain}>
                  <div style={S.email}>{invite.email}</div>
                  <div style={S.meta}>
                    Approved {invite.acceptedAt ? new Date(invite.acceptedAt).toLocaleDateString() : "—"}
                  </div>
                </div>
                <button
                  style={S.revokeButton}
                  disabled={busyId === invite.id}
                  onClick={() => setStatus(invite, "pending")}
                >
                  {busyId === invite.id ? "…" : "Revoke"}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
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
  container: { width: "100%", maxWidth: 480 },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, color: C.parchment, margin: 0 },
  msg: { color: C.parchmentDim, padding: "24px 4px" },
  section: { ...glass, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", color: C.brassSoft, marginBottom: 10 },
  empty: { color: C.parchmentLow, fontSize: 14, padding: "4px 0" },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 0", borderTop: `1px solid rgba(210,190,130,0.1)`,
  },
  rowMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  email: { color: C.parchment, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { color: C.parchmentLow, fontSize: 12 },
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
