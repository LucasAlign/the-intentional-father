import { useState, useEffect, useRef, useCallback } from "react";
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
const WOOD = `${import.meta.env.BASE_URL}woodgrain.png`;

interface Message { role: "user" | "assistant"; content: string; }

function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const toggle = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript as string).join("");
      onResult(t);
    };
    recRef.current = rec;
    rec.start();
  }, [listening, onResult]);
  return { listening, toggle };
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SendIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill={C.ink}><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>;
}
function MicIcon({ on }: { on: boolean }) {
  const col = on ? C.ink : C.parchmentDim;
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Interview() {
  const { isLoading, isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [booted, setBooted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { listening, toggle: toggleMic } = useSpeech(setInput);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Load history on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const r = await fetch(`${API}/interview/history`, { credentials: "include" });
        if (!r.ok) return;
        const d = await r.json() as { messages: Message[]; questionNumber: number; onboarded: boolean };
        if (d.onboarded) { setLocation("/"); return; }
        if (d.messages.length > 0) {
          setMessages(d.messages);
          setQuestionNumber(d.questionNumber);
          setBooted(true);
        } else {
          // Auto-trigger Steward's greeting
          await triggerStart();
        }
      } catch {
        // ignore
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function triggerStart() {
    setSending(true);
    try {
      const r = await fetch(`${API}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: "" }),
      });
      if (!r.ok) {
        const errorText = await r.text();
        setMessages([{ role: "assistant", content: "Steward is connected, but onboarding failed (" + r.status + "): " + (errorText || "No error details returned.") }]);
        return;
      }
      const d = await r.json() as { message: string; questionNumber: number; complete?: boolean };
      setMessages([{ role: "assistant", content: d.message }]);
      setQuestionNumber(d.questionNumber);
      if (d.complete) setComplete(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
      setBooted(true);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch(`${API}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok) {
        const errorText = await r.text();
        setMessages(prev => [...prev, { role: "assistant", content: "Steward is connected, but onboarding failed (" + r.status + "): " + (errorText || "No error details returned.") }]);
        return;
      }
      const d = await r.json() as { message: string; questionNumber: number; complete?: boolean };
      setMessages(prev => [...prev, { role: "assistant", content: d.message }]);
      setQuestionNumber(d.questionNumber);
      if (d.complete) setComplete(true);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  function confirm() {
    setConfirming(true);
    setTimeout(() => setLocation("/"), 600);
  }

  async function skip() {
    try {
      await fetch(`${API}/interview/skip`, { method: "POST", credentials: "include" });
    } finally {
      setLocation("/");
    }
  }

  if (isLoading || (!booted && isAuthenticated)) {
    return (
      <div style={R.root}>
        <div style={R.woodLayer} />
        <div style={R.ambient} />
        <div style={R.loadWrap}><div style={R.loadText}>Loading…</div></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={R.root}>
        <div style={R.woodLayer} />
        <div style={R.ambient} />
        <div style={R.loadWrap}>
          <div style={R.loadText}>Please sign in to continue.</div>
          <button style={R.loginBtn} onClick={() => login()}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div style={R.root}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{display:none}input::placeholder{color:${C.parchmentLow}}@keyframes micPulse{0%,100%{box-shadow:0 0 14px ${C.brassGlow}}50%{box-shadow:0 0 26px ${C.brassGlow},0 0 40px rgba(216,170,62,0.2)}}`}</style>
      <div style={R.woodLayer} />
      <div style={R.ambient} />

      {/* Header */}
      <div style={R.header}>
        <div>
          <div style={R.logo}><span style={R.logoText}>Steward</span><span style={R.logoDot}>.</span></div>
          <div style={R.tagline}>GETTING TO KNOW YOU</div>
        </div>
        <div style={R.progressWrap}>
          <div style={R.progressLabel}>Question {Math.min(questionNumber, 10)} of 10</div>
          <div style={R.progressBar}>
            <div style={{ ...R.progressFill, width: `${Math.min((questionNumber / 10) * 100, 100)}%` }} />
          </div>
          {!complete && <button style={R.skipBtn} onClick={skip}>Skip for now</button>}
        </div>
      </div>

      {/* Chat area */}
      <div style={R.chatArea}>
        {messages.length === 0 && (
          <div style={R.empty}>Starting your onboarding conversation…</div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ ...R.bubble, ...(m.role === "user" ? R.bubbleU : R.bubbleA) }}>
            {m.role === "assistant" && <div style={R.bubbleName}>STEWARD</div>}
            <div style={{ ...R.bubbleText, ...(m.role === "user" ? R.bubbleTextU : {}) }}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ ...R.bubble, ...R.bubbleA }}>
            <div style={R.bubbleName}>STEWARD</div>
            <div style={{ ...R.bubbleText, color: C.parchmentDim }}>…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Confirm screen overlay */}
      {complete && (
        <div style={R.confirmOverlay}>
          <div style={R.confirmSheet}>
            <div style={R.confirmStrip} />
            <div style={R.confirmTitle}>That's how I understand you.</div>
            <div style={R.confirmSub}>
              I'll use this to plan with you — on work, family, and everything in between.
              You can always update your profile later.
            </div>
            <button
              style={R.confirmBtn}
              onClick={confirm}
              disabled={confirming}
            >
              {confirming ? "Opening your dashboard…" : "Let's get started →"}
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      {!complete && (
        <div style={R.inputWrap}>
          <div style={R.inputBar}>
            <input
              style={R.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Your answer…"
              disabled={sending}
              autoFocus
            />
            <button
              style={{ ...R.micBtn, ...(listening ? R.micBtnOn : {}) }}
              onClick={toggleMic}
              title={listening ? "Stop" : "Voice input"}
            >
              <MicIcon on={listening} />
            </button>
            <button style={R.sendBtn} disabled={sending || !input.trim()} onClick={send}>
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const R: Record<string, CSSProperties> = {
  root: {
    width: "100%", maxWidth: 440, margin: "0 auto", height: "100vh",
    display: "flex", flexDirection: "column", fontFamily: F, color: C.parchment,
    position: "relative", overflow: "hidden", background: C.ink,
  },
  woodLayer: {
    position: "fixed", inset: 0, zIndex: 0,
    backgroundImage: `url(${WOOD})`, backgroundSize: "cover",
    backgroundPosition: "center", backgroundRepeat: "no-repeat",
  },
  ambient: {
    position: "fixed", inset: 0, zIndex: 1,
    background: "radial-gradient(120% 80% at 50% 0%, rgba(40,36,20,0.25) 0%, rgba(8,10,5,0.45) 70%, rgba(4,5,2,0.7) 100%)",
  },
  header: {
    position: "relative", zIndex: 10,
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "54px 24px 14px",
  },
  logo: { display: "flex", alignItems: "baseline" },
  logoText: { fontSize: 42, fontWeight: 400, color: C.parchment, letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  logoDot: { fontSize: 42, color: C.brass, textShadow: `0 0 20px ${C.brassGlow}` },
  tagline: { fontSize: 10, letterSpacing: "0.24em", color: C.brassSoft, marginTop: 5, opacity: 0.9 },
  progressWrap: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, paddingTop: 14 },
  progressLabel: { fontSize: 11, color: C.parchmentDim, letterSpacing: "0.08em" },
  progressBar: {
    width: 96, height: 3,
    background: "rgba(0,0,0,0.4)", borderRadius: 2, overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg,${C.brassDeep},${C.brass})`,
    borderRadius: 2, transition: "width 0.5s ease",
    boxShadow: `0 0 6px ${C.brassGlow}`,
  },
  skipBtn: {
    background: "none", border: "none", padding: 0, marginTop: 8,
    color: C.parchmentLow, fontSize: 11, letterSpacing: "0.04em",
    textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", fontFamily: F,
  },
  chatArea: {
    flex: 1, overflowY: "auto", padding: "8px 18px 12px",
    position: "relative", zIndex: 10,
  },
  empty: {
    fontSize: 13, color: C.parchmentDim, textAlign: "center",
    padding: "24px 0", opacity: 0.7,
  },
  bubble: { marginBottom: 16, maxWidth: "88%" },
  bubbleA: { marginRight: "auto" },
  bubbleU: { marginLeft: "auto" },
  bubbleName: { fontSize: 9, letterSpacing: "0.14em", color: C.brassSoft, marginBottom: 5, fontWeight: 600 },
  bubbleText: {
    ...glass, padding: "13px 15px", fontSize: 14, lineHeight: 1.65,
    color: C.parchment, display: "inline-block", whiteSpace: "pre-wrap", borderTopLeftRadius: 5,
  },
  bubbleTextU: {
    background: `linear-gradient(135deg,${C.walnut},${C.walnutMid})`,
    border: `1px solid ${C.walnutLite}50`,
    borderTopLeftRadius: 18, borderTopRightRadius: 5,
  },
  inputWrap: {
    position: "relative", zIndex: 10,
    padding: "0 18px 28px",
    background: "linear-gradient(0deg,rgba(8,10,5,0.95),transparent)",
  },
  inputBar: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(8,10,5,0.55)", backdropFilter: "blur(8px)",
    borderRadius: 30, padding: "11px 11px 11px 17px",
    border: "1px solid rgba(210,190,130,0.16)",
    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.3)",
  },
  input: {
    flex: 1, background: "none", border: "none",
    color: C.parchment, fontSize: 14, outline: "none", fontFamily: F,
  },
  micBtn: {
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.16)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "all 0.2s",
  },
  micBtnOn: {
    background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`,
    border: `1px solid ${C.brass}`, boxShadow: `0 0 14px ${C.brassGlow}`,
    animation: "micPulse 1s ease-in-out infinite",
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: "50%",
    background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`,
    border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, boxShadow: `0 2px 12px ${C.brassGlow},inset 0 1px 0 rgba(255,240,200,0.3)`,
  },
  loadWrap: {
    position: "relative", zIndex: 10, flex: 1,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
  },
  loadText: { color: C.parchmentDim, fontSize: 14, letterSpacing: "0.04em" },
  loginBtn: {
    padding: "14px 48px", borderRadius: 14, border: `1px solid ${C.brass}`,
    cursor: "pointer", fontFamily: F, fontSize: 15, fontWeight: 600,
    letterSpacing: "0.03em", color: C.ink,
    background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`,
    boxShadow: `0 4px 18px ${C.brassGlow},inset 0 1px 0 rgba(255,240,200,0.3)`,
  },
  confirmOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "flex-end", zIndex: 200,
  },
  confirmSheet: {
    width: "100%", maxWidth: 440, margin: "0 auto",
    position: "relative", overflow: "hidden",
    background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))",
    backdropFilter: "blur(24px)", borderRadius: "22px 22px 0 0",
    padding: "28px 24px 52px",
    border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none",
    boxShadow: "0 -10px 50px rgba(0,0,0,0.7)",
  },
  confirmStrip: {
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg,transparent,${C.brass},transparent)`,
    boxShadow: `0 0 14px ${C.brassGlow}`,
  },
  confirmTitle: {
    fontSize: 24, color: C.parchment, fontWeight: 400, marginBottom: 12,
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  confirmSub: {
    fontSize: 14, lineHeight: 1.7, color: C.parchmentMid, marginBottom: 28,
  },
  confirmBtn: {
    width: "100%",
    background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`,
    border: "none", borderRadius: 14, color: C.ink,
    fontSize: 15, fontWeight: 700, padding: "16px",
    cursor: "pointer", fontFamily: F,
    boxShadow: `0 4px 18px ${C.brassGlow}`,
  },
};
