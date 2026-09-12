import { useState, type CSSProperties } from "react";

const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272",
  brass: "#D8AA3E", brassSoft: "#C89A34", brassDeep: "#9A7420", brassGlow: "rgba(216,170,62,0.55)",
  ink: "#0C0E07",
};
const F = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif";

// #95 — the post-onboarding app tour: a one-time, six-step map of the tabs.
// Shared by Interview.tsx (shown once after a first-time onboarding
// completion, via its "Let's get started" confirm screen) and Home.tsx's
// Profile menu ("Replay App Tour", reopened on demand) so both entry points
// stay in sync on content. Deliberately separate copy from the per-tab
// Helpful Hints (#83) — this is a broad map shown once up front, not a
// replacement for each tab's own contextual FirstVisitTip, which still
// fires the first time the user actually lands there.
export const APP_TOUR_STEPS: { title: string; body: string }[] = [
  { title: "Today", body: "Your daily home base. Set today's marriage intention, check off your top 3 priorities, log a quick Pulse Check, and reflect before you're done." },
  { title: "Tribe", body: "Keep the people who matter most in view. Track your spouse, kids, family, and friends, and log the commitments you've made to each of them." },
  { title: "Work", body: "See your work at a glance. Group jobs under pursuits — a business, a job, a volunteer role — so progress stays organized instead of scattered." },
  { title: "Sphere", body: "A weekly check-in on how you're actually doing. Walk through five areas — family, yourself, community, provision, and leadership — and watch the trend over time." },
  { title: "Steward (Chat)", body: "Your AI accountability partner. Brain-dump, ask for a plan, or just think out loud — Steward already knows what's going on with your day, your people, and your work." },
  { title: "Week", body: "Everything ahead, in one place. Work, commitments, and calendar events together, one week at a time." },
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
        <div style={T.progress}>
          {APP_TOUR_STEPS.map((_, i) => (
            <div key={i} style={{ ...T.dot, ...(i < step ? T.dotDone : i === step ? T.dotCurrent : {}) }} />
          ))}
        </div>
        <div style={T.stepLabel}>{step + 1} of {APP_TOUR_STEPS.length}</div>
        <div style={T.title}>{current.title}</div>
        <div style={T.body}>{current.body}</div>
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
    padding: "28px 24px 40px",
    border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none",
    boxShadow: "0 -10px 50px rgba(0,0,0,0.7)",
    fontFamily: F,
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
  },
  progress: { display: "flex", gap: 5, marginBottom: 14, marginTop: 4 },
  dot: { flex: 1, height: 4, borderRadius: 2, background: "rgba(210,190,130,0.15)" },
  dotDone: { background: C.brassSoft },
  dotCurrent: { background: C.brass },
  stepLabel: { fontSize: 11, letterSpacing: "0.08em", color: C.parchmentDim, marginBottom: 8 },
  title: { fontSize: 24, color: C.parchment, fontWeight: 400, marginBottom: 12, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  body: { fontSize: 14, lineHeight: 1.7, color: C.parchmentMid, marginBottom: 28 },
  nav: { display: "flex", justifyContent: "space-between", gap: 12 },
  navBtn: {
    flex: 1, background: "none", border: "1px solid rgba(210,190,130,0.28)",
    color: C.brassSoft, fontFamily: F, fontSize: 14, fontWeight: 600,
    padding: "13px 16px", borderRadius: 14, cursor: "pointer",
  },
  navBtnDisabled: { opacity: 0.3, pointerEvents: "none" },
  navBtnPrimary: {
    background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`,
    border: "none", color: C.ink, fontWeight: 700,
    boxShadow: `0 4px 18px ${C.brassGlow}`,
  },
};
