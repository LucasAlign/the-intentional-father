import { useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272", parchmentLow: "#6E664C",
  brass: "#D8AA3E", brassSoft: "#C89A34", brassDeep: "#9A7420", brassGlow: "rgba(216,170,62,0.55)",
  walnut: "#5A3A20", walnutMid: "#7A4E2C", walnutLite: "#9C6840",
  up: "#8FAE6E", mid: "#C89A34", down: "#C87060",
  biz1: "#8AB46A", biz2: "#6AAEC8",
  ink: "#0C0E07",
};
const F = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif";

type TourIconName = "sun" | "heart" | "work" | "globe" | "cal" | "steward";

// Paths copied verbatim from Home.tsx's <Icon> (bottom nav) so the tour's
// medallion always matches the tab it's introducing.
function TourIcon({ name, size = 18, color = C.brass, stroke = 1.8 }: { name: TourIconName; size?: number; color?: string; stroke?: number }) {
  // SIM-11 (#142): every svg path below is already aria-hidden, but this one
  // glyph wasn't — leaving it exposed to assistive tech, which read it right
  // up against the step title ("Chat") in headRow below with no separator,
  // producing the "S Chat" the simulation flagged. Hiding it (it's already
  // decorative — the visible label stays "Chat", matching the nav tab) fixes
  // that without touching any copy.
  if (name === "steward") return <span aria-hidden="true" style={{ fontSize: size * 0.75, fontWeight: 700, color }}>S</span>;
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<Exclude<TourIconName, "steward">, ReactElement> = {
    sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 1v3M12 20v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
    work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><line x1="3.3" y1="8.5" x2="20.7" y2="8.5" /><line x1="3.3" y1="15.5" x2="20.7" y2="15.5" /></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>,
  };
  return <svg {...p} aria-hidden="true">{paths[name]}</svg>;
}

// Small caption-icon variant (brassSoft, matching the real app's eyebrow
// labels e.g. "VERSE OF THE DAY") for icons the tab-preview panels need but
// that don't appear in the bottom nav.
function EyebrowIcon({ name }: { name: "book" | "target" }) {
  const p = { width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: C.brassSoft, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg {...p} aria-hidden="true">
      {name === "book"
        ? <path d="M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
        : <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="1" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="1" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="23" y2="12" /></>}
    </svg>
  );
}

// Battery-gauge icon copied from Home.tsx's PulseGaugeIcon (Sphere's
// down/mid/up state buttons) — same shape and fill levels, so the preview
// reads as "the actual Sphere control," not an approximation.
const GAUGE_FILL: Record<"down" | "mid" | "up", { y: number; h: number }> = { down: { y: 20, h: 7 }, mid: { y: 13, h: 14 }, up: { y: 6, h: 21 } };
const GAUGE_COLOR: Record<"down" | "mid" | "up", string> = { down: C.down, mid: C.mid, up: C.up };
function GaugeIcon({ state, active }: { state: "down" | "mid" | "up"; active: boolean }) {
  const f = GAUGE_FILL[state];
  const col = active ? GAUGE_COLOR[state] : C.parchmentLow;
  return (
    <svg viewBox="0 0 20 28" width={15} height={19} aria-hidden="true">
      <rect x="6" y="1" width="8" height="4" rx="1.5" fill="none" stroke={col} strokeWidth={1.8} />
      <rect x="1" y="5" width="18" height="22" rx="4" fill="none" stroke={col} strokeWidth={2} />
      <rect x="4" y={f.y} width="12" height={f.h} rx="1.5" fill={col} />
    </svg>
  );
}

// ── per-tab preview panels ──────────────────────────────────────────────
// Each mirrors that tab's actual layout/labels/iconography with plausible
// mock data — a "peek" so the description isn't the only clue to what the
// tab looks like. Deliberately not live data: these run before onboarding
// even finishes, when there's nothing real to show yet.
function TodayPreview() {
  return (
    <div>
      <div style={T.eyebrow}><EyebrowIcon name="book" /><span>VERSE OF THE DAY</span></div>
      <div style={T.verseChip}>&ldquo;Be strong and courageous. Do not be afraid...&rdquo;<cite style={T.verseCite}>JOSHUA 1:9</cite></div>
      <div style={{ ...T.eyebrow, marginTop: 9 }}><EyebrowIcon name="target" /><span>PRIORITIES</span></div>
      <div style={T.prioRow}><div style={T.prioNum}>1</div><span>Finish client proposal</span></div>
      <div style={T.prioRow}><div style={T.prioNumDone}>✓</div><span style={{ textDecoration: "line-through", color: C.parchmentLow }}>Call Mom</span></div>
    </div>
  );
}
function TribePreview() {
  return (
    <div>
      <div style={T.eyebrow}><span>PEOPLE</span></div>
      <div style={T.personRow}><span style={T.star}>★</span><div><div style={T.personName}>Sarah</div><div style={T.personTag}>Spouse</div></div></div>
      <div style={T.personRow}><span style={T.star}>★</span><div><div style={T.personName}>Emma</div><div style={T.personTag}>Child</div></div></div>
      <div style={{ ...T.eyebrow, marginTop: 9 }}><span>OPEN</span></div>
      <div style={T.commitRow}>
        <div style={T.commitDot} />
        <div><div style={T.commitText}>Plan a date night</div><div style={T.commitSub}>For Sarah · Said Sep 10</div></div>
      </div>
    </div>
  );
}
function WorkPreview() {
  return (
    <div>
      <div style={{ ...T.pursuitHead, color: C.biz1 }}>FREELANCE DESIGN</div>
      <div style={T.jobRow}><div><div style={T.jobName}>Acme Co. — Logo</div><div style={T.jobMeta}>Design  •  Due Sep 20</div></div><div style={T.jobPct}>65%</div></div>
      <div style={T.jobBar}><div style={{ ...T.jobBarFill, width: "65%", background: C.biz1 }} /></div>
      <div style={T.jobRow}><div><div style={T.jobName}>Bright Path — Site</div><div style={T.jobMeta}>Build  •  Due Oct 2</div></div><div style={T.jobPct}>30%</div></div>
      <div style={T.jobBar}><div style={{ ...T.jobBarFill, width: "30%", background: C.biz1 }} /></div>
    </div>
  );
}
function SpherePreview() {
  const rows: { label: string; active: "down" | "mid" | "up" }[] = [
    { label: "Family", active: "up" },
    { label: "Yourself", active: "mid" },
    { label: "Provision", active: "up" },
  ];
  return (
    <div>
      {rows.map(row => (
        <div key={row.label} style={T.sphereCatRow}>
          <div style={T.sphereCatLabel}>{row.label}</div>
          <div style={T.sphereGauges}>
            {(["down", "mid", "up"] as const).map(s => <GaugeIcon key={s} state={s} active={s === row.active} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
function ChatPreview() {
  return (
    <div>
      <div style={T.toneRow}>
        <div style={{ ...T.tonePill, ...T.tonePillActive }}>Straight Talk</div>
        <div style={T.tonePill}>Middle of the Road</div>
        <div style={T.tonePill}>Take it Easy</div>
      </div>
      <div style={T.bubbleName}>STEWARD</div>
      <div style={{ ...T.bubble, ...T.bubbleA }}>Tuesday's wide open on your calendar — want to block time for that proposal?</div>
      <div style={{ ...T.bubble, ...T.bubbleU }}>Yeah, let's do 2pm</div>
    </div>
  );
}
function WeekPreview() {
  return (
    <div>
      <div style={T.weekDayRow}>
        <div style={T.weekDayL}><div style={{ ...T.wdDay, color: C.brass }}>Tue</div><div style={T.wdDate}>Sep 9</div></div>
        <div style={{ flex: 1 }}><div style={T.weekItem}><span style={T.wiTitle}>Team sync</span><span style={T.wiTime}>10:00 AM</span></div></div>
        <div style={T.todayPill}>Today</div>
      </div>
      <div style={T.weekDayRow}>
        <div style={T.weekDayL}><div style={T.wdDay}>Wed</div><div style={T.wdDate}>Sep 10</div></div>
        <div style={{ flex: 1 }}><div style={T.weekItem}><span style={T.wiTitle}>Date night — Sarah</span></div></div>
      </div>
      <div style={T.weekDayRow}>
        <div style={T.weekDayL}><div style={T.wdDay}>Thu</div><div style={T.wdDate}>Sep 11</div></div>
        <div style={{ flex: 1 }}><span style={T.wiEmpty}>—</span></div>
      </div>
    </div>
  );
}

interface TourStep { icon: TourIconName; title: string; body: string; label: string; preview: ReactNode; }

// #95 — the post-onboarding app tour: a one-time, six-step map of the tabs.
// Shared by Interview.tsx (shown once after a first-time onboarding
// completion, via its "Let's get started" confirm screen) and Home.tsx's
// Profile menu ("Replay App Tour", reopened on demand) so both entry points
// stay in sync on content. Deliberately separate copy from the per-tab
// Helpful Hints (#83) — this is a broad map shown once up front, not a
// replacement for each tab's own contextual FirstVisitTip, which still
// fires the first time the user actually lands there. Each step also leads
// with a small "peek" preview mirroring that tab's real layout/labels/icons
// with plausible mock data (never live data — this can run before the user
// has anything real yet), plus the tab's own bottom-nav icon next to its
// name, so the description isn't the only clue to what's coming.
export const APP_TOUR_STEPS: TourStep[] = [
  { icon: "sun", title: "Today", label: "TODAY", preview: <TodayPreview />, body: "Your daily home base. Set today's marriage intention, check off your top 3 priorities, log a quick Pulse Check, and reflect before you're done." },
  { icon: "heart", title: "Tribe", label: "TRIBE", preview: <TribePreview />, body: "Keep the people who matter most in view. Track your spouse, kids, family, and friends, and log the commitments you've made to each of them." },
  { icon: "work", title: "Work", label: "WORK", preview: <WorkPreview />, body: "See your work at a glance. Group jobs under pursuits — a business, a job, a volunteer role — so progress stays organized instead of scattered." },
  { icon: "globe", title: "Sphere", label: "SPHERE", preview: <SpherePreview />, body: "A weekly check-in on how you're actually doing. Walk through five areas — family, yourself, community, provision, and leadership — and watch the trend over time." },
  { icon: "steward", title: "Chat", label: "CHAT", preview: <ChatPreview />, body: "Your AI accountability partner. Brain-dump, ask for a plan, or just think out loud — Steward already knows what's going on with your day, your people, and your work." },
  { icon: "cal", title: "Week", label: "THIS WEEK", preview: <WeekPreview />, body: "Everything ahead, in one place. Work, commitments, and calendar events together, one week at a time." },
];

export function AppTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === APP_TOUR_STEPS.length - 1;
  const current = APP_TOUR_STEPS[step];

  return (
    <div style={T.overlay}>
      <div style={T.sheet}>
        <div style={T.strip} />
        <button style={T.skip} onClick={onClose} aria-label="Skip tour">✕</button>
        <div style={T.preview}>
          {current.preview}
          <div style={T.previewFade} />
          <div style={T.previewLabel}>{current.label} · PREVIEW</div>
        </div>
        <div style={T.stepNum}>{step + 1} of {APP_TOUR_STEPS.length}</div>
        <div style={T.headRow}>
          <div style={T.iconBadge}><TourIcon name={current.icon} /></div>
          <div style={T.title}>{current.title}</div>
        </div>
        <div style={T.body}>{current.body}</div>
        <div style={T.progress}>
          {APP_TOUR_STEPS.map((_, i) => (
            <div key={i} style={{ ...T.dot, ...(i < step ? T.dotDone : i === step ? T.dotCurrent : {}) }} />
          ))}
        </div>
        <div style={T.nav}>
          <button
            style={{ ...T.navBtn, ...(step === 0 ? T.navBtnDisabled : {}) }}
            disabled={step === 0}
            onClick={() => setStep(s => s - 1)}
          >
            ‹ Back
          </button>
          <button style={{ ...T.navBtn, ...T.navBtnPrimary }} onClick={() => (last ? onClose() : setStep(s => s + 1))}>
            {last ? "Done" : "Next ›"}
          </button>
        </div>
      </div>
    </div>
  );
}

const T: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300,
  },
  sheet: {
    width: "100%", maxWidth: 440, margin: "0 auto",
    position: "relative", overflow: "hidden",
    background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))",
    backdropFilter: "blur(24px)", borderRadius: "22px 22px 0 0",
    padding: "24px 22px 36px",
    border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none",
    boxShadow: "0 -10px 50px rgba(0,0,0,0.7)",
    fontFamily: F, color: C.parchment,
  },
  strip: {
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg,transparent,${C.brass},transparent)`,
    boxShadow: `0 0 14px ${C.brassGlow}`,
  },
  skip: {
    position: "absolute", top: 16, right: 16,
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(255,255,255,0.06)", border: "none",
    color: C.parchmentDim, fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2,
  },

  // ── preview "peek" panel ──────────────────────────────────────────
  preview: {
    position: "relative", height: 168, borderRadius: 16, overflow: "hidden",
    background: "linear-gradient(160deg, rgba(28,24,15,0.9), rgba(14,12,7,0.95))",
    border: "1px solid rgba(210,190,130,0.14)",
    boxShadow: "inset 0 1px 0 rgba(255,240,200,0.05), inset 0 -30px 26px -10px rgba(8,7,4,0.9)",
    marginBottom: 16, padding: "13px 14px",
    fontSize: 11, color: C.parchmentMid,
  },
  previewFade: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 40,
    background: "linear-gradient(0deg, rgba(15,13,7,1), rgba(15,13,7,0))",
    pointerEvents: "none",
  },
  previewLabel: {
    position: "absolute", bottom: 6, left: 14, fontSize: 9, letterSpacing: "0.16em",
    color: C.parchmentLow,
  },
  eyebrow: { display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, letterSpacing: "0.1em", color: C.brassSoft, fontWeight: 700, marginBottom: 6 },

  // Today
  verseChip: { fontStyle: "italic", color: C.parchmentMid, fontSize: 10.5, lineHeight: 1.4, borderLeft: `2px solid ${C.brassSoft}`, paddingLeft: 7 },
  verseCite: { display: "block", fontStyle: "normal", color: C.parchmentLow, fontSize: 9, marginTop: 2, letterSpacing: "0.04em" },
  prioRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 },
  prioNum: { width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `1.4px solid ${C.parchmentLow}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.parchmentMid },
  prioNumDone: { width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7A9860,#4E6838)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.parchment },

  // Tribe
  personRow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 5 },
  star: { color: C.brass, fontSize: 11 },
  personName: { color: C.parchment, fontWeight: 600, fontSize: 11 },
  personTag: { color: C.parchmentLow, fontSize: 9 },
  commitRow: { display: "flex", alignItems: "center", gap: 8 },
  commitDot: { width: 14, height: 14, borderRadius: "50%", border: `1.4px solid ${C.parchmentLow}`, flexShrink: 0 },
  commitText: { color: C.parchment, fontSize: 11 },
  commitSub: { color: C.parchmentLow, fontSize: 9 },

  // Work
  pursuitHead: { fontSize: 9.5, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 },
  jobRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  jobName: { color: C.parchment, fontSize: 11, fontWeight: 600 },
  jobMeta: { color: C.parchmentLow, fontSize: 9 },
  jobPct: { color: C.parchmentDim, fontSize: 9.5, flexShrink: 0, marginLeft: 6 },
  jobBar: { height: 3, borderRadius: 2, background: "rgba(210,190,130,0.12)", margin: "4px 0 9px" },
  jobBarFill: { height: "100%", borderRadius: 2 },

  // Sphere
  sphereCatRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  sphereCatLabel: { color: C.parchment, fontSize: 12, fontWeight: 600 },
  sphereGauges: { display: "flex", gap: 5 },

  // Chat
  toneRow: { display: "flex", gap: 5, marginBottom: 10 },
  tonePill: { flex: 1, textAlign: "center", fontSize: 9, padding: "5px 3px", borderRadius: 9, border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentDim },
  tonePillActive: { borderColor: C.brass, color: C.parchment, background: "rgba(216,170,62,0.14)" },
  bubble: { maxWidth: "80%", padding: "7px 10px", borderRadius: 11, fontSize: 10.5, lineHeight: 1.45, marginBottom: 6 },
  bubbleA: { background: "rgba(210,190,130,0.08)", border: "1px solid rgba(210,190,130,0.16)", borderTopLeftRadius: 3, color: C.parchmentMid },
  bubbleU: { background: `linear-gradient(135deg,${C.walnut},${C.walnutMid})`, border: `1px solid ${C.walnutLite}`, borderTopRightRadius: 3, marginLeft: "auto", color: C.parchment },
  bubbleName: { fontSize: 8, letterSpacing: "0.12em", color: C.brassSoft, marginBottom: 3, fontWeight: 700 },

  // Week — vertical day-by-day agenda, matching the real tab (not a 7-col grid)
  weekDayRow: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8, position: "relative" },
  weekDayL: { width: 44, flexShrink: 0 },
  wdDay: { fontSize: 11, color: C.parchmentMid, fontWeight: 600 },
  wdDate: { fontSize: 9, color: C.parchmentLow },
  weekItem: { marginBottom: 2 },
  wiTitle: { fontSize: 10.5, color: C.parchment },
  wiTime: { fontSize: 9, color: C.brassSoft, marginLeft: 6 },
  wiEmpty: { fontSize: 10.5, color: C.parchmentLow },
  todayPill: { position: "absolute", right: 0, top: 0, fontSize: 8, letterSpacing: "0.06em", fontWeight: 700, color: C.ink, background: C.brass, borderRadius: 8, padding: "2px 6px" },

  // ── icon + title + body + progress + nav ─────────────────────────
  stepNum: { fontSize: 10.5, letterSpacing: "0.08em", color: C.parchmentDim, marginBottom: 8 },
  headRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 9 },
  iconBadge: {
    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(216,170,62,0.12)", border: "1px solid rgba(216,170,62,0.4)",
    boxShadow: `0 0 10px ${C.brassGlow}`,
  },
  title: { fontSize: 23, color: C.parchment, fontWeight: 400, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  body: { fontSize: 13.5, lineHeight: 1.65, color: C.parchmentMid, marginBottom: 20 },
  progress: { display: "flex", gap: 5, marginBottom: 14 },
  dot: { flex: 1, height: 4, borderRadius: 2, background: "rgba(210,190,130,0.15)" },
  dotDone: { background: C.brassSoft },
  dotCurrent: { background: C.brass },
  nav: { display: "flex", justifyContent: "space-between", gap: 12 },
  navBtn: {
    flex: 1, background: "none", border: "1px solid rgba(210,190,130,0.28)",
    color: C.brassSoft, fontFamily: F, fontSize: 13.5, fontWeight: 600,
    padding: "12px 14px", borderRadius: 13, cursor: "pointer",
  },
  navBtnDisabled: { opacity: 0.3, pointerEvents: "none" },
  navBtnPrimary: {
    background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`,
    border: "none", color: C.ink, fontWeight: 700,
    boxShadow: `0 4px 16px ${C.brassGlow}`,
  },
};
