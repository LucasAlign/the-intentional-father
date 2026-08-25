// PROTOTYPE — throwaway. Exploring issue #9 option 2: what UI would actually
// let a priority be marked "stuck" (tasks.partial) and carry free-text notes
// (tasks.notes), instead of dropping those columns. Not wired to the real
// API — mock in-memory data only. Three structurally different variants,
// switch with the floating bar or ?variant=A|B|C. Delete before merging;
// capture the winner on the prototype/priority-status branch.
import { useEffect, useState, type CSSProperties } from "react";
import { useSearch, useLocation } from "wouter";

const C = {
  parchment: "#EEE4C4", parchmentMid: "#D2C7A2", parchmentDim: "#9C9272", parchmentLow: "#6E664C",
  brass: "#D8AA3E", brassSoft: "#C89A34", brassDeep: "#9A7420", brassGlow: "rgba(216,170,62,0.55)",
  walnut: "#5A3A20", walnutMid: "#7A4E2C", walnutLite: "#9C6840",
  ink: "#0C0E07",
  stuckAmber: "#C89A5A", stuckGlow: "rgba(200,154,90,0.35)",
};
const F = "'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif";
const glass: CSSProperties = {
  background: "rgba(24,20,12,0.55)", backdropFilter: "blur(14px)",
  border: "1px solid rgba(210,190,130,0.14)", borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,240,200,0.06)",
};

type Status = "open" | "stuck" | "done";
type Priority = { id: number; text: string; category: string; status: Status; notes: string };

const SEED: Priority[] = [
  { id: 1, text: "Finish Q3 numbers for the shop", category: "Work", status: "open", notes: "" },
  { id: 2, text: "Call Mom back", category: "Family", status: "stuck", notes: "Tried twice, voicemail both times." },
  { id: 3, text: "Read Proverbs 3 with the kids", category: "Faith", status: "open", notes: "" },
];

const page: CSSProperties = {
  width: "100%", maxWidth: 440, margin: "0 auto", minHeight: "100vh",
  fontFamily: F, color: C.parchment, background: C.ink, padding: "28px 20px 120px",
};
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.16em", color: C.brassSoft, fontWeight: 600, marginBottom: 14 };
const card: CSSProperties = { ...glass, padding: "18px 20px", marginBottom: 14 };
const prioTitle: CSSProperties = { fontSize: 15, color: C.parchment, lineHeight: 1.4, marginBottom: 3 };
const prioSub: CSSProperties = { fontSize: 12, color: C.parchmentDim, lineHeight: 1.4 };

// ── Variant A — inline row controls, no modal ──────────────────────────────
function VariantA({ items, setItems }: { items: Priority[]; setItems: (p: Priority[]) => void }) {
  const [noteOpenId, setNoteOpenId] = useState<number | null>(null);
  function setStatus(id: number, status: Status) {
    setItems(items.map(p => (p.id === id ? { ...p, status } : p)));
  }
  function setNotes(id: number, notes: string) {
    setItems(items.map(p => (p.id === id ? { ...p, notes } : p)));
  }
  return (
    <div style={page}>
      <div style={eyebrow}>A — INLINE ROW CONTROLS</div>
      {items.map(p => (
        <div key={p.id} style={{ ...card, borderLeft: p.status === "stuck" ? `3px solid ${C.stuckAmber}` : card.borderLeft }}>
          <div style={prioTitle}>{p.text}</div>
          <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
            {(["open", "stuck", "done"] as Status[]).map(s => (
              <button key={s} onClick={() => setStatus(p.id, s)} style={{
                flex: 1, padding: "7px 0", borderRadius: 18, fontSize: 12, fontFamily: F, cursor: "pointer",
                border: `1px solid ${p.status === s ? C.brass : "rgba(210,190,130,0.2)"}`,
                background: p.status === s ? (s === "stuck" ? C.stuckGlow : "rgba(216,170,62,0.18)") : "transparent",
                color: p.status === s ? C.parchment : C.parchmentDim, fontWeight: p.status === s ? 700 : 400,
              }}>
                {s === "open" ? "○ Open" : s === "stuck" ? "◐ Stuck" : "✓ Done"}
              </button>
            ))}
          </div>
          {p.status === "stuck" && <div style={{ fontSize: 11, color: C.stuckAmber, marginBottom: 8 }}>Steward will check in on this in chat.</div>}
          {noteOpenId === p.id ? (
            <textarea autoFocus defaultValue={p.notes} onBlur={e => { setNotes(p.id, e.target.value); setNoteOpenId(null); }}
              style={{ width: "100%", minHeight: 60, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 10, color: C.parchment, fontSize: 13, fontFamily: F, padding: 10, outline: "none", resize: "vertical" }} />
          ) : (
            <button onClick={() => setNoteOpenId(p.id)} style={{ background: "none", border: "none", color: C.brassSoft, fontSize: 12, cursor: "pointer", fontFamily: F, padding: 0 }}>
              {p.notes ? `note: "${p.notes}"` : "+ add note"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Variant B — detail modal, extends the #21 PriorityDetailModal pattern ──
function VariantB({ items, setItems }: { items: Priority[]; setItems: (p: Priority[]) => void }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = items.find(p => p.id === openId) || null;
  return (
    <div style={page}>
      <div style={eyebrow}>B — DETAIL MODAL (extends #21's pattern)</div>
      {items.map(p => (
        <div key={p.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }} onClick={() => setOpenId(p.id)}>
          <div style={{ flex: 1 }}>
            <div style={prioTitle}>{p.text}</div>
            <div style={prioSub}>{p.status === "stuck" ? "Stuck — needs a nudge" : p.status === "done" ? "Done" : p.category}</div>
          </div>
          <div style={{ color: C.parchmentDim, fontSize: 18 }}>›</div>
        </div>
      ))}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 200, backdropFilter: "blur(6px)" }}>
          <div style={{ width: "100%", maxWidth: 440, margin: "0 auto", background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))", borderRadius: "22px 22px 0 0", padding: "24px 24px 40px", border: "1px solid rgba(210,190,130,0.18)" }}>
            <div style={{ fontSize: 18, color: C.parchment, marginBottom: 18 }}>{open.text}</div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: C.brassSoft, fontWeight: 600, marginBottom: 8 }}>STATUS</div>
            {(["open", "stuck", "done"] as Status[]).map(s => (
              <button key={s} onClick={() => setItems(items.map(p => p.id === open.id ? { ...p, status: s } : p))} style={{
                width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12, marginBottom: 8, fontFamily: F, fontSize: 14, cursor: "pointer",
                border: `1px solid ${open.status === s ? C.brass : "rgba(210,190,130,0.16)"}`,
                background: open.status === s ? "rgba(216,170,62,0.14)" : "rgba(8,10,5,0.4)",
                color: open.status === s ? C.parchment : C.parchmentDim,
              }}>
                {s === "open" ? "Still moving" : s === "stuck" ? "Stuck — need a nudge" : "Done"}
              </button>
            ))}
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: C.brassSoft, fontWeight: 600, margin: "16px 0 8px" }}>NOTES</div>
            <textarea defaultValue={open.notes} onBlur={e => setItems(items.map(p => p.id === open.id ? { ...p, notes: e.target.value } : p))}
              style={{ width: "100%", minHeight: 80, background: "rgba(8,10,5,0.7)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: 14, outline: "none", marginBottom: 16, resize: "vertical" }} />
            <button onClick={() => setOpenId(null)} style={{ width: "100%", background: "none", border: "none", color: C.parchmentDim, fontSize: 13, cursor: "pointer", padding: 10, fontFamily: F }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Variant C — AI-initiated in chat, no manual controls on the row ────────
function VariantC({ items, setItems }: { items: Priority[]; setItems: (p: Priority[]) => void }) {
  const stuckCandidate = items.find(p => p.status !== "done") || null;
  const [answered, setAnswered] = useState(false);
  function reply(status: Status, note: string) {
    if (stuckCandidate) setItems(items.map(p => p.id === stuckCandidate.id ? { ...p, status, notes: note } : p));
    setAnswered(true);
  }
  return (
    <div style={page}>
      <div style={eyebrow}>C — AI-INITIATED, NO MANUAL ROW CONTROLS</div>
      {items.map(p => (
        <div key={p.id} style={card}>
          <div style={prioTitle}>{p.text}</div>
          <div style={prioSub}>{p.status === "stuck" ? `Stuck — "${p.notes}"` : p.category}</div>
        </div>
      ))}
      {stuckCandidate && !answered && (
        <div style={{ ...card, border: `1px solid ${C.brassSoft}`, marginTop: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: C.brassSoft, fontWeight: 700, marginBottom: 8 }}>STEWARD</div>
          <div style={{ fontSize: 14, color: C.parchment, marginBottom: 14, lineHeight: 1.5 }}>
            "{stuckCandidate.text}" has been open a few days. Still moving, or are you stuck?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => reply("open", "")} style={{ flex: 1, padding: "10px 0", borderRadius: 18, border: "1px solid rgba(210,190,130,0.2)", background: "transparent", color: C.parchmentMid, fontFamily: F, fontSize: 13, cursor: "pointer" }}>Still moving</button>
            <button onClick={() => reply("stuck", "Honestly, stuck.")} style={{ flex: 1, padding: "10px 0", borderRadius: 18, border: `1px solid ${C.stuckAmber}`, background: C.stuckGlow, color: C.parchment, fontFamily: F, fontSize: 13, cursor: "pointer" }}>Honestly, stuck.</button>
          </div>
        </div>
      )}
      {answered && <div style={{ ...prioSub, marginTop: 12 }}>Logged. The status + note above came straight from your chat reply — no form.</div>}
    </div>
  );
}

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
const LABELS = { A: "Inline row controls", B: "Detail modal (extends #21)", C: "AI-initiated in chat" } as const;

function PrototypeSwitcher({ variant }: { variant: keyof typeof VARIANTS }) {
  const [, navigate] = useLocation();
  const keys = Object.keys(VARIANTS) as (keyof typeof VARIANTS)[];
  function go(delta: number) {
    const i = keys.indexOf(variant);
    const next = keys[(i + delta + keys.length) % keys.length];
    navigate(`/prototype/priority-status?variant=${next}`);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (import.meta.env.PROD) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999,
      display: "flex", alignItems: "center", gap: 14, background: "#1a1a1a", border: "1px solid #444",
      borderRadius: 999, padding: "10px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", fontFamily: "monospace",
    }}>
      <button onClick={() => go(-1)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>←</button>
      <span style={{ color: "#0f0", fontSize: 13 }}>{variant} — {LABELS[variant]}</span>
      <button onClick={() => go(1)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>→</button>
    </div>
  );
}

export default function PrototypePriorityStatus() {
  const search = useSearch();
  const variant = (new URLSearchParams(search).get("variant") as keyof typeof VARIANTS) || "A";
  const [items, setItems] = useState<Priority[]>(SEED);
  const Variant = VARIANTS[variant] || VariantA;
  return (
    <>
      <Variant items={items} setItems={setItems} />
      <PrototypeSwitcher variant={variant in VARIANTS ? variant : "A"} />
    </>
  );
}
