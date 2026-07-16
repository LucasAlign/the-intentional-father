import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties, ReactElement, PointerEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new () => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new () => any;
  }
}

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
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript as string).join("");
      onResult(transcript);
    };
    recRef.current = rec;
    rec.start();
  }, [listening, onResult]);
  return { listening, toggle };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task { id: number; text: string; category: string; partial: boolean; done: boolean; }
interface Commit { id: number; text: string; madeDate: string; done: boolean; }
interface Job { id: number; biz: string; name: string; stage: string; due: string; pct: number; }
interface Event { id: number; date: string; time: string; title: string; sub: string; tag: string; kind: string; }
interface Message { role: "user" | "assistant"; content: string; }
interface Journal { reflect: string; commit_text: string; }

const API = "/api";
const WOOD = `${import.meta.env.BASE_URL}woodgrain.png`;

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getJson(url: string, fallback: unknown) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function getList<T>(url: string): Promise<T[]> {
  return asList<T>(await getJson(url, []));
}

// ── Palette ──────────────────────────────────────────────────────────────────
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

// ── Icons ─────────────────────────────────────────────────────────────────────
type IconName = "book" | "heart" | "target" | "cal" | "clock" | "pen" | "chat" | "sun" | "work" | "user" | "send" | "mic";
function Icon({ name, size = 15, color = C.brassSoft, stroke = 1.6 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const m: Record<IconName, ReactElement> = {
    book: <path d="M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="1" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="1" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="23" y2="12" /></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    chat: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-1L3 20l1.1-4A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />,
    sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 1v3M12 20v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    send: <path d="M3 11l18-8-8 18-2-7-8-3z" fill={color} stroke="none" />,
    mic: <><path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>,
  };
  return <svg {...p}>{m[name]}</svg>;
}

const NAV: { id: TabId; icon: IconName | "arloA"; label: string }[] = [
  { id: "today", icon: "sun", label: "Today" },
  { id: "her", icon: "heart", label: "Her" },
  { id: "work", icon: "work", label: "Work" },
  { id: "arlo", icon: "arloA", label: "Steward" },
  { id: "week", icon: "cal", label: "Week" },
];
type TabId = "today" | "her" | "work" | "arlo" | "week";

const BIZ_PALETTE = ["#8AB46A", "#6AAEC8", "#C89840", "#B080C0", "#C87060", "#60A8B4", "#A890C0"];
function bizC(b: string, bizList: string[]) {
  const i = bizList.indexOf(b);
  return BIZ_PALETTE[i >= 0 ? i % BIZ_PALETTE.length : 0];
}

// ── Date helpers ───────────────────────────────────────────────────────────────
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function weekDays() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { key: ymd(d), day: d.toLocaleDateString("en-US", { weekday: "short" }), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  });
}


const JOURNAL_PROMPTS = [
  "What's one specific way I can love my wife better today?",
  "Where do my kids need patience, attention, or encouragement from me today?",
  "What's been bothering me that I need to name honestly instead of carrying quietly?",
  "What am I thankful for today, and how can I say it out loud?",
  "What would make my wife feel seen before the day is over?",
  "What's one small moment I can create with my kids today?",
  "Where am I tempted to withdraw, and what would love do instead?",
];

const EXERCISE_PROMPTS = [
  "Walk outside, move your body, or stretch before the day starts.",
  "Get 20 minutes of movement in before the work takes over.",
  "Do something simple: walk, pushups, mobility, or a steady sweat.",
  "Move early so your body is not the last thing you remember.",
];

function dayOfYear(date = new Date()) {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
}

function rotatingItem(items: string[]) {
  return items[dayOfYear() % items.length];
}

function parseJobDueDate(due: string): string | null {
  const value = due.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const currentYear = new Date().getFullYear();
  const numeric = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const year = numeric[3] ? Number(numeric[3].length === 2 ? "20" + numeric[3] : numeric[3]) : currentYear;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return ymd(date);
  }

  const monthName = value.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?$/i);
  if (monthName) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.findIndex(m => monthName[1].toLowerCase().startsWith(m));
    const day = Number(monthName[2]);
    const year = monthName[3] ? Number(monthName[3]) : currentYear;
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) return ymd(date);
  }

  return null;
}

function jobCalendarEvent(job: Job): Event | null {
  const date = parseJobDueDate(job.due);
  if (!date) return null;
  return {
    id: -100000 - job.id,
    date,
    time: "Due",
    title: job.name,
    sub: job.stage,
    tag: job.biz,
    kind: "work",
  };
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { isLoading, isAuthenticated, pendingApproval, login, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("today");

  const [verse, setVerse] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [journal, setJournal] = useState<Journal>({ reflect: "", commit_text: "" });
  const [commits, setCommits] = useState<Commit[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [today, setToday] = useState<Event[]>([]);
  const [week, setWeek] = useState<Event[]>([]);
  const [chat, setChat] = useState<Message[]>([]);

  const [ci, setCi] = useState("");
  const [sending, setSending] = useState(false);
  const [jobModal, setJobModal] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [calendarAccounts, setCalendarAccounts] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshTasks = useCallback(() => {
    getList<Task>(`${API}/tasks`).then(setTasks);
  }, []);
  const refreshCommits = useCallback(() => {
    getList<Commit>(`${API}/commits`).then(setCommits);
  }, []);
  const refreshJobs = useCallback(() => {
    getList<Job>(`${API}/jobs`).then(setJobs);
  }, []);
  const refreshCalendarStatus = useCallback(() => {
    getJson(`${API}/google-calendar/status`, { accounts: [] }).then((d) => {
      setCalendarAccounts(isRecord(d) && Array.isArray(d.accounts) ? d.accounts as string[] : isRecord(d) && d.connected ? ["Google Calendar"] : []);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Check onboarding before loading data
    fetch(`${API}/interview/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { onboarded?: boolean } | null) => {
        if (d && d.onboarded === false) { setLocation("/interview"); }
      })
      .catch(() => {});

    const days = weekDays();
    const start = days[0].key, end = days[6].key;
    fetch(`${API}/verse`).then(r => r.ok ? r.text() : "").then(v => v && setVerse(v)).catch(() => {});
    getJson(`${API}/journal`, null).then((d) => { if (isRecord(d)) setJournal({ reflect: String(d.reflect || ""), commit_text: String(d.commitText ?? d.commit_text ?? "") }); });
    getList<Event>(`${API}/coming-up`).then(setToday);
    getList<Event>(`${API}/coming-up?start=${start}&end=${end}`).then(setWeek);
    getList<Message>(`${API}/chat-history`).then((m) => setChat(prev => prev.length ? prev : m));
    getJson(`${API}/admin/is-admin`, { isAdmin: false }).then((d) => setIsAdmin(isRecord(d) && d.isAdmin === true));
    refreshTasks(); refreshCommits(); refreshJobs(); refreshCalendarStatus();
  }, [isAuthenticated, setLocation, refreshTasks, refreshCommits, refreshJobs, refreshCalendarStatus]);

  async function saveJournal(next: Journal) {
    setJournal(next);
    try {
      await fetch(`${API}/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    } catch { /* keep local */ }
  }

  async function send(msg?: string) {
    const text = (msg ?? ci).trim();
    if (!text || sending) return;
    setCi("");
    if (tab !== "arlo") setTab("arlo");
    setChat(p => [...p, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (r.ok) {
        const d = await r.json();
        setChat(p => [...p, { role: "assistant", content: d.message }]);
      } else {
        const errorText = await r.text();
        setChat(p => [...p, { role: "assistant", content: "Steward is connected, but the chat request failed (" + r.status + "): " + (errorText || "No error details returned.") }]);
      }
    } catch {
      setChat(p => [...p, { role: "assistant", content: "I couldn't reach the server just now. Try again in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  if (!isAuthenticated) return <AuthGate loading={isLoading} pendingApproval={pendingApproval} onLogin={login} />;

  return (
    <div style={R.root}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{display:none}input::placeholder,textarea::placeholder{color:${C.parchmentLow}}@keyframes micPulse{0%,100%{box-shadow:0 0 14px ${C.brassGlow}}50%{box-shadow:0 0 26px ${C.brassGlow},0 0 40px rgba(216,170,62,0.2)}}`}</style>
      <div style={R.woodLayer} />
      <div style={R.ambient} />

      <div style={R.header}>
        <div>
          <div style={R.logo}><span style={R.logoText}>Steward</span><span style={R.logoDot}>.</span></div>
          <div style={R.tagline}>FOCUSED. FAITHFUL. FREE.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <button style={{ ...R.avatar, padding: 0, cursor: "pointer" }} onClick={() => setLocation("/admin")} title="Sign-ups" aria-label="Sign-ups">
              <Icon name="target" size={18} color={C.parchmentDim} />
            </button>
          )}
          <button style={{ ...R.avatar, padding: 0, cursor: "pointer" }} onClick={logout} title="Log out" aria-label="Log out"><Icon name="user" size={20} color={C.parchmentDim} /></button>
        </div>
      </div>

      <div style={R.screen}>
        {tab === "today" && <Today verse={verse} tasks={tasks} journal={journal} events={today} onSend={send} ci={ci} setCi={setCi} sending={sending} onSaveJournal={saveJournal} refreshTasks={refreshTasks} />}
        {tab === "her" && <Her commits={commits} refresh={refreshCommits} />}
        {tab === "work" && <Work jobs={jobs} onJob={() => setJobModal(true)} onEdit={setEditJob} />}
        {tab === "arlo" && <ArloChat messages={chat} input={ci} setInput={setCi} send={() => send()} sending={sending} />}
        {tab === "week" && <WeekView events={week} jobs={jobs} calendarAccounts={calendarAccounts} onConnectCalendar={() => { window.location.href = `${API}/google-calendar/connect`; }} onDisconnectCalendar={async (email) => { try { await fetch(`${API}/google-calendar/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); refreshCalendarStatus(); } catch { /* ignore */ } }} />}
      </div>

      <div style={R.navWrap}>
        <div style={R.navLine} />
        <nav style={R.nav}>
          {NAV.map(n => (
            <button key={n.id} style={R.navBtn} onClick={() => setTab(n.id)}>
              {n.icon === "arloA"
                ? <div style={{ ...R.arloA, ...(tab === n.id ? R.arloAOn : {}) }}>A</div>
                : <Icon name={n.icon as IconName} size={20} color={tab === n.id ? C.brass : C.parchmentLow} stroke={tab === n.id ? 1.9 : 1.6} />}
              <span style={{ ...R.navLabel, ...(tab === n.id ? R.navLabelOn : {}) }}>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {jobModal && <JobModal onClose={() => setJobModal(false)} onCreated={refreshJobs} bizSuggestions={[...new Set(jobs.map(j => j.biz))]} />}
      {editJob && <JobEditModal job={editJob} onClose={() => setEditJob(null)} onSaved={refreshJobs} onDeleted={refreshJobs} />}
    </div>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────
function Today({ verse, tasks, journal, events, onSend, ci, setCi, sending, onSaveJournal, refreshTasks }: {
  verse: string; tasks: Task[]; journal: Journal; events: Event[];
  onSend: (m?: string) => void; ci: string; setCi: (v: string) => void; sending: boolean;
  onSaveJournal: (j: Journal) => void; refreshTasks: () => void;
}) {
  const [intent, setIntent] = useState(journal.commit_text);
  const [reflect, setReflect] = useState(journal.reflect);
  const [writing, setWriting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [exerciseDone, setExerciseDone] = useState(false);
  useEffect(() => { setIntent(journal.commit_text); setReflect(journal.reflect); }, [journal.commit_text, journal.reflect]);

  const hr = new Date().getHours();
  const greeting = `Good ${hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening"}, Bryant.`;
  const sep = verse.indexOf(" — ");
  const vRef = sep === -1 ? "" : verse.slice(0, sep);
  const vText = sep === -1 ? verse : verse.slice(sep + 3);
  const top3 = tasks.filter(t => !deletingIds.includes(t.id)).slice(0, 3);
  const journalPrompt = rotatingItem(JOURNAL_PROMPTS);
  const exercisePrompt = rotatingItem(EXERCISE_PROMPTS);

  async function addTask() {
    const t = newTask.trim();
    if (!t) return;
    setNewTask("");
    try {
      const r = await fetch(`${API}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      if (r.ok) refreshTasks();
    } catch { /* ignore */ }
  }
  async function complete(id: number) {
    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
      if (r.ok) refreshTasks();
    } catch { /* ignore */ }
  }
  async function deleteTask(id: number) {
    setDeletingIds(prev => prev.includes(id) ? prev : [...prev, id]);
    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
      if (r.ok) refreshTasks();
      else setDeletingIds(prev => prev.filter(item => item !== id));
    } catch {
      setDeletingIds(prev => prev.filter(item => item !== id));
    }
  }

  return (
    <div style={S.scroll}>
      <div style={S.greetRow}>
        <div><div style={S.greet}>{greeting}</div><div style={S.greetSub}>Let's build something that matters.</div></div>
        <div style={S.dateChip}><Icon name="cal" size={13} color={C.parchmentMid} /><span style={{ marginLeft: 6 }}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
      </div>

      <div style={S.verseCard}>
        <div style={S.eyebrow}><Icon name="book" /><span style={S.eyeText}>VERSE OF THE DAY</span></div>
        <div style={S.verseText}>{vText || "…"}</div>
        {vRef && <div style={S.verseRef}>{vRef.toUpperCase()}</div>}
      </div>

      <div style={S.cardCentered}>
        <div style={S.eyebrow}><Icon name="heart" /><span style={S.eyeText}>MARRIAGE INTENTION</span></div>
        <textarea
          style={S.intentInput}
          value={intent}
          rows={2}
          placeholder="What's your intention for your marriage today?"
          onChange={e => setIntent(e.target.value)}
          onBlur={() => intent !== journal.commit_text && onSaveJournal({ ...journal, commit_text: intent })}
        />
      </div>

      <div style={{ ...S.exerciseCard, ...(exerciseDone ? S.exerciseDone : {}) }}>
        <div style={{ flex: 1 }}>
          <div style={S.eyebrow}><Icon name="clock" /><span style={S.eyeText}>MORNING 20 MIN</span></div>
          <div style={S.exerciseText}>{exerciseDone ? "Movement logged for today." : exercisePrompt}</div>
        </div>
        <button style={{ ...S.exerciseBtn, ...(exerciseDone ? S.exerciseBtnDone : {}) }} onClick={() => setExerciseDone(done => !done)}>{exerciseDone ? "Done" : "Log"}</button>
      </div>

      <div style={S.card}>
        <div style={S.eyebrow}><Icon name="target" /><span style={S.eyeText}>TOP 3 PRIORITIES</span></div>
        {top3.length === 0 ? (
          <div style={S.empty}>No open priorities. Add the one thing that matters most.</div>
        ) : (
          <div style={{ position: "relative", marginTop: 4 }}>
            <div style={S.prioLine} />
            {top3.map((t, i) => (
              <SwipePriority key={t.id} task={t} index={i} isLast={i === top3.length - 1} onComplete={complete} onDelete={deleteTask} />
            ))}
          </div>
        )}
        {adding ? (
          <div style={{ ...S.logRow, marginTop: 14, marginBottom: 0 }}>
            <input style={S.logInput} value={newTask} autoFocus placeholder="One thing that moves it forward…" onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addTask(); setAdding(false); } }} />
            <button style={S.logBtn} onClick={() => { addTask(); setAdding(false); }}>Add</button>
          </div>
        ) : (
          <button style={{ ...S.intakeBtn, marginTop: 14 }} onClick={() => setAdding(true)}>＋  Add a priority</button>
        )}
      </div>

      <div style={S.card}>
        <div style={S.eyebrow}><Icon name="cal" /><span style={S.eyeText}>COMING UP</span></div>
        {events.length === 0 ? (
          <div style={S.empty}>Nothing scheduled today.</div>
        ) : (
          <div style={S.upRow}>
            {events.slice(0, 3).map((u, i, arr) => (
              <div key={u.id} style={{ ...S.upCol, ...(i < arr.length - 1 ? S.upBorder : {}) }}>
                <div style={S.upTime}><Icon name="clock" size={12} color={C.brassSoft} /><span style={{ marginLeft: 5 }}>{u.time}</span></div>
                <div style={S.upTitle}>{u.title}</div>
                {u.sub && <div style={S.upSub}>{u.sub}</div>}
                {u.tag && <div style={{ ...S.upTag, ...(u.kind === "her" ? S.tagHer : S.tagWork) }}>{u.tag}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.journalCard}>
        <div style={{ flex: 1 }}>
          <div style={S.eyebrow}><Icon name="pen" /><span style={S.eyeText}>DAILY JOURNAL PROMPT</span></div>
          <div style={S.journalText}>{journalPrompt}</div>
          {writing && (
            <textarea
              style={S.journalInput}
              value={reflect}
              rows={3}
              autoFocus
              placeholder="Write your reflection…"
              onChange={e => setReflect(e.target.value)}
              onBlur={() => reflect !== journal.reflect && onSaveJournal({ ...journal, reflect })}
            />
          )}
        </div>
        <button style={S.writeBtn} onClick={() => setWriting(w => !w)}>{writing ? "Done" : "Write ›"}</button>
      </div>

      <TodayMsgBar ci={ci} setCi={setCi} sending={sending} onSend={onSend} />

      <div style={S.bottomTag}>FAITH. FOCUS. FOLLOW THROUGH.</div>
      <div style={{ height: 8 }} />
    </div>
  );
}

function SwipePriority({ task, index, isLast, onComplete, onDelete }: { task: Task; index: number; isLast: boolean; onComplete: (id: number) => void; onDelete: (id: number) => void }) {
  const [startX, setStartX] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function down(e: PointerEvent<HTMLDivElement>) {
    setStartX(e.clientX);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (startX === null) return;
    setOffset(Math.min(0, Math.max(-104, e.clientX - startX)));
  }
  function up() {
    if (offset <= -72) onDelete(task.id);
    setStartX(null);
    setOffset(0);
    setDragging(false);
  }

  return (
    <div style={{ ...S.swipeWrap, marginBottom: isLast ? 0 : 20 }}>
      <div style={S.deleteCue}>Delete</div>
      <div
        style={{ ...S.prioRow, ...S.swipeFront, transform: "translateX(" + offset + "px)", transition: dragging ? "none" : "transform 0.18s ease" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <button style={S.prioNum} title="Mark done" onClick={() => onComplete(task.id)}>{index + 1}</button>
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div style={S.prioTitle}>{task.text}</div>
          {task.category && <div style={S.prioSub}>{task.category}</div>}
        </div>
      </div>
    </div>
  );
}

function TodayMsgBar({ ci, setCi, sending, onSend }: { ci: string; setCi: (v: string) => void; sending: boolean; onSend: (m?: string) => void }) {
  const { listening, toggle } = useSpeech(setCi);
  return (
    <div style={S.msgBar}>
      <Icon name="chat" size={17} color={C.parchmentLow} />
      <input style={S.msgInput} value={ci} onChange={e => setCi(e.target.value)} onKeyDown={e => e.key === "Enter" && onSend()} placeholder="Message Steward..." />
      <button style={{ ...S.micBtn, ...(listening ? S.micBtnOn : {}) }} onClick={toggle} title={listening ? "Stop" : "Voice input"}>
        <Icon name="mic" size={15} color={listening ? C.ink : C.parchmentDim} stroke={1.8} />
      </button>
      <button style={S.msgSend} disabled={sending} onClick={() => onSend()}><Icon name="send" size={16} color={C.ink} /></button>
    </div>
  );
}

// ── Her ───────────────────────────────────────────────────────────────────
function Her({ commits, refresh }: { commits: Commit[]; refresh: () => void }) {
  const [val, setVal] = useState("");
  const open = commits.filter(c => !c.done), done = commits.filter(c => c.done);

  async function add() {
    const t = val.trim();
    if (!t) return;
    setVal("");
    try { const r = await fetch(`${API}/commits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) }); if (r.ok) refresh(); } catch { /* */ }
  }
  async function toggle(c: Commit) {
    try { const r = await fetch(`${API}/commits/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !c.done }) }); if (r.ok) refresh(); } catch { /* */ }
  }

  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Her</div>
      <div style={S.pageSub}>Commitments you've made. Don't let them disappear.</div>
      <div style={S.card}><div style={S.eyebrow}><Icon name="heart" /><span style={S.eyeText}>TODAY'S INTENTION</span></div><div style={S.intent}>Ask her about her week before you talk about yours.</div></div>
      <div style={S.logRow}>
        <input style={S.logInput} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Log a commitment you made..." />
        <button style={S.logBtn} onClick={add}>Log</button>
      </div>
      {open.length > 0 && (
        <div style={S.card}>
          <div style={S.eyebrow}><span style={S.eyeText}>OPEN</span></div>
          {open.map(c => (
            <div key={c.id} style={S.commitRow}>
              <button style={S.dot} onClick={() => toggle(c)} />
              <div><div style={S.prioTitle}>{c.text}</div><div style={S.prioSub}>Said {c.madeDate}</div></div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.5 }}>
          <div style={S.eyebrow}><span style={S.eyeText}>KEPT</span></div>
          {done.map(c => (
            <div key={c.id} style={S.commitRow}>
              <button style={{ ...S.dot, ...S.dotDone }} onClick={() => toggle(c)}>✓</button>
              <div style={{ ...S.prioTitle, textDecoration: "line-through" }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}
      {commits.length === 0 && <div style={{ ...S.card }}><div style={S.empty}>No commitments logged yet.</div></div>}
      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Work ───────────────────────────────────────────────────────────────────
function Work({ jobs, onJob, onEdit }: { jobs: Job[]; onJob: () => void; onEdit: (j: Job) => void }) {
  const sortedJobs = [...jobs].sort((a, b) => a.biz.localeCompare(b.biz) || a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  const groups = [...new Set(sortedJobs.map(j => j.biz))];
  let lastBiz = "";
  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Work</div>
      <div style={S.pageSub}>Active jobs by category. Tap a row to edit.</div>
      {sortedJobs.length === 0 ? (
        <div style={S.card}><div style={S.empty}>No active jobs yet. Add one to start planning ahead.</div></div>
      ) : (
        <div style={S.workList}>
          {sortedJobs.map(j => {
            const showHeader = j.biz !== lastBiz;
            lastBiz = j.biz;
            return (
              <div key={j.id}>
                {showHeader && <div style={{ ...S.workGroup, color: bizC(j.biz, groups) }}>{j.biz.toUpperCase()}</div>}
                <button style={S.workRow} onClick={() => onEdit(j)}>
                  <div style={S.workMain}>
                    <div style={S.workName}>{j.name}</div>
                    <div style={S.workMeta}>{[j.stage, j.due].filter(Boolean).join("  •  ") || "No stage or due date"}</div>
                  </div>
                  <div style={S.workPct}>{j.pct}%</div>
                  <div style={S.workTrack}><div style={{ ...S.workTrackFill, width: j.pct + "%", background: j.pct >= 80 ? C.brass : bizC(j.biz, groups) }} /></div>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button style={{ ...S.intakeBtn, marginTop: 12 }} onClick={onJob}>＋  Add new job</button>
      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Arlo chat ───────────────────────────────────────────────────────────────
function ArloChat({ messages, input, setInput, send, sending }: { messages: Message[]; input: string; setInput: (v: string) => void; send: () => void; sending: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <div style={S.chatWrap}>
      <div style={{ padding: "4px 18px 0" }}><div style={S.pageTitle}>Steward</div><div style={S.pageSub}>Your partner. Straight talk only.</div></div>
      <div style={S.chatMsgs}>
        {messages.length === 0 && <div style={{ ...S.empty, marginTop: 24 }}>No messages yet. Brain dump anything.</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ ...S.bubble, ...(m.role === "user" ? S.bubbleU : S.bubbleA) }}>
            {m.role === "assistant" && <div style={S.bubbleName}>STEWARD</div>}
            <div style={{ ...S.bubbleText, ...(m.role === "user" ? S.bubbleTextU : {}) }}>{m.content}</div>
          </div>
        ))}
        {sending && <div style={{ ...S.bubble, ...S.bubbleA }}><div style={S.bubbleName}>STEWARD</div><div style={{ ...S.bubbleText, color: C.parchmentDim }}>…</div></div>}
        <div ref={endRef} />
      </div>
      <ArloChatBar input={input} setInput={setInput} send={send} sending={sending} />
    </div>
  );
}

function ArloChatBar({ input, setInput, send, sending }: { input: string; setInput: (v: string) => void; send: () => void; sending: boolean }) {
  const { listening, toggle } = useSpeech(setInput);
  return (
    <div style={S.chatBar}>
      <input style={S.msgInput} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Brain dump anything..." />
      <button style={{ ...S.micBtn, ...(listening ? S.micBtnOn : {}) }} onClick={toggle} title={listening ? "Stop" : "Voice input"}>
        <Icon name="mic" size={15} color={listening ? C.ink : C.parchmentDim} stroke={1.8} />
      </button>
      <button style={S.msgSend} disabled={sending} onClick={send}><Icon name="send" size={16} color={C.ink} /></button>
    </div>
  );
}

// ── Week ───────────────────────────────────────────────────────────────────
function WeekView({ events, jobs, calendarAccounts, onConnectCalendar, onDisconnectCalendar }: { events: Event[]; jobs: Job[]; calendarAccounts: string[]; onConnectCalendar: () => void; onDisconnectCalendar: (email: string) => void }) {
  const days = weekDays();
  const todayKey = ymd(new Date());
  const datedWork = jobs.map(jobCalendarEvent).filter((event): event is Event => Boolean(event));
  const calendarEvents = [...events, ...datedWork].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>This Week</div>
      <div style={S.pageSub}>Work, commitments, and calendar events in one pass.</div>
      {days.map(d => {
        const items = calendarEvents.filter(e => e.date === d.key);
        const isToday = d.key === todayKey;
        const past = d.key < todayKey;
        return (
          <div key={d.key} style={{ ...S.weekRow, ...(isToday ? S.weekToday : {}), ...(past ? { opacity: 0.3 } : {}) }}>
            <div style={S.weekL}><div style={{ ...S.weekDay, ...(isToday ? { color: C.brass } : {}) }}>{d.day}</div><div style={S.prioSub}>{d.label}</div></div>
            <div style={{ flex: 1 }}>
              {items.length === 0 ? <div style={S.prioSub}>—</div> : items.map(it => (
                <div key={it.id} style={S.weekItem}>
                  <div style={S.weekItemTop}><span style={S.prioTitle}>{it.title}</span>{it.time && <span style={S.weekTime}>{it.time}</span>}</div>
                  {(it.sub || it.tag) && <div style={S.prioSub}>{[it.sub, it.tag].filter(Boolean).join("  •  ")}</div>}
                </div>
              ))}
            </div>
            {isToday && <div style={S.todayPill}>Today</div>}
          </div>
        );
      })}
      <div style={S.calendarBottom}>
        {calendarAccounts.length > 0 && calendarAccounts.map(email => (
          <div key={email} style={S.calendarAccount}>
            <span>{email}</span>
            <button style={S.calendarRemoveBtn} onClick={() => onDisconnectCalendar(email)}>Remove</button>
          </div>
        ))}
        <button style={S.calendarSmallBtn} onClick={onConnectCalendar}>Add Google Calendar</button>
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Job intake modal ─────────────────────────────────────────────────────────
function JobModal({ onClose, onCreated, bizSuggestions }: { onClose: () => void; onCreated: () => void; bizSuggestions: string[] }) {
  const Qs = [
    { q: "Which business?", type: "text" as const, ph: "Business name", key: "biz" },
    { q: "What's the job?", type: "text" as const, ph: "e.g. First Baptist — monument sign", key: "name" },
    { q: "When does it need to be done?", type: "text" as const, ph: "e.g. June 20, end of month", key: "due" },
    { q: "Materials needed?", type: "text" as const, ph: "e.g. 4×8 aluminum, vinyl", key: "materials" },
    { q: "Rough budget or quote?", type: "text" as const, ph: "e.g. $2,400 or not sure", key: "budget" },
    { q: "Anything that could slow you down?", type: "text" as const, ph: "e.g. approval, weather", key: "risk" },
  ];
  const [step, setStep] = useState(0);
  const [val, setVal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const q = Qs[step];

  async function submit(final: Record<string, string>) {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biz: final.biz || "General", name: final.name || "Untitled job", due: final.due || "", stage: "New", pct: 0 }),
      });
      if (r.ok) { onCreated(); onClose(); }
      else { setErr("Couldn't save the job. Try again."); setSaving(false); }
    } catch { setErr("Couldn't reach the server. Try again."); setSaving(false); }
  }
  function advance(answer: string) {
    const next = { ...answers, [q.key]: answer };
    setAnswers(next); setVal("");
    if (step < Qs.length - 1) setStep(s => s + 1);
    else submit(next);
  }

  return (
    <div style={M.overlay}>
      <div style={M.sheet}>
        <div style={M.strip} />
        <div style={M.head}><div style={M.title}>New Job</div><div style={S.prioSub}>{step + 1} / {Qs.length}</div></div>
        <div style={M.track}><div style={{ ...M.fill, width: ((step + 1) / Qs.length * 100) + "%" }} /></div>
        <div style={M.q}>{q.q}</div>
        <>
          <input style={M.input} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && val.trim() && advance(val)} placeholder={q.ph} autoFocus />
          {step === 0 && bizSuggestions.length > 0 && (
            <div style={E.chipRow}>
              {bizSuggestions.map(b => (
                <button key={b} style={E.chip} onClick={() => advance(b)}>{b}</button>
              ))}
            </div>
          )}
          <button style={M.next} disabled={saving} onClick={() => advance(val)}>{step < Qs.length - 1 ? "Next →" : saving ? "Saving…" : "Add Job ✓"}</button>
        </>
        {err && <div style={{ ...S.empty, color: "#D4A090", marginTop: 4 }}>{err}</div>}
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Job edit modal ────────────────────────────────────────────────────────────
function JobEditModal({ job, onClose, onSaved, onDeleted }: { job: Job; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(job.name);
  const [biz, setBiz] = useState(job.biz);
  const [stage, setStage] = useState(job.stage);
  const [due, setDue] = useState(job.due);
  const [pct, setPct] = useState(job.pct);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim() || !biz.trim()) { setErr("Name and business are required."); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/jobs/${job.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), biz: biz.trim(), stage: stage.trim(), due: due.trim(), pct }),
      });
      if (r.ok) { onSaved(); onClose(); }
      else { setErr("Couldn't save. Try again."); setSaving(false); }
    } catch { setErr("Couldn't reach the server."); setSaving(false); }
  }

  async function del() {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/jobs/${job.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted(); onClose(); }
      else { setErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setErr("Couldn't reach the server."); setDeleting(false); }
  }

  return (
    <div style={M.overlay}>
      <div style={M.sheet}>
        <div style={M.strip} />
        <div style={M.head}><div style={M.title}>Edit Job</div></div>

        <div style={E.fieldGroup}>
          <div style={E.label}>Job name</div>
          <input style={M.input} value={name} onChange={e => setName(e.target.value)} placeholder="Job name" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Business</div>
          <input style={M.input} value={biz} onChange={e => setBiz(e.target.value)} placeholder="Business name" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ ...E.fieldGroup, flex: 1 }}>
            <div style={E.label}>Stage</div>
            <input style={M.input} value={stage} onChange={e => setStage(e.target.value)} placeholder="e.g. In progress" />
          </div>
          <div style={{ ...E.fieldGroup, flex: 1 }}>
            <div style={E.label}>Due</div>
            <input style={M.input} value={due} onChange={e => setDue(e.target.value)} placeholder="e.g. June 30" />
          </div>
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Progress — {pct}%</div>
          <input type="range" min={0} max={100} value={pct} onChange={e => setPct(Number(e.target.value))} style={E.slider} />
        </div>

        {err && <div style={{ ...S.empty, color: "#D4A090", marginBottom: 8 }}>{err}</div>}
        <button style={M.next} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Changes"}</button>
        <button style={{ ...M.cancel, color: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Delete Job"}</button>
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Auth gate ───────────────────────────────────────────────────────────────────
function AuthGate({ loading, pendingApproval, onLogin }: { loading: boolean; pendingApproval: boolean; onLogin: (provider?: "google" | "microsoft" | "demo") => void }) {
  return (
    <div style={R.root}>
      <div style={R.woodLayer} />
      <div style={R.ambient} />
      <div style={G.wrap}>
        <div style={R.logo}><span style={R.logoText}>Steward</span><span style={R.logoDot}>.</span></div>
        <div style={{ ...R.tagline, textAlign: "center", marginBottom: 38 }}>FOCUSED. FAITHFUL. FREE.</div>
        {loading ? (
          <div style={G.loading}>Loading...</div>
        ) : pendingApproval ? (
          <div style={G.welcome}>Thanks for signing up — you're on the list. We'll let you in soon.</div>
        ) : (
          <>
            <div style={G.welcome}>Welcome back.</div>
            <button style={G.googleBtn} onClick={() => onLogin("google")}>Continue with Google</button>
            <button style={{ ...G.googleBtn, marginTop: 10 }} onClick={() => onLogin("microsoft")}>Continue with Microsoft</button>
            <div style={G.notice}>New here? Sign in above to request access.</div>
          </>
        )}
      </div>
    </div>
  );
}
const G: Record<string, CSSProperties> = {
  wrap: { position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" },
  loading: { color: C.parchmentLow, fontSize: 14, letterSpacing: "0.04em" },
  welcome: { fontSize: 26, fontWeight: 400, color: C.parchment, textShadow: "0 2px 8px rgba(0,0,0,0.5)", marginBottom: 22, textAlign: "center" },
  googleBtn: { width: "100%", background: "rgba(30,26,16,0.62)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchmentMid, fontSize: 14, fontWeight: 700, padding: "13px 16px", cursor: "pointer", fontFamily: F },
  notice: { fontSize: 12, color: C.parchmentLow, marginTop: 14, textAlign: "center" },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const R: Record<string, CSSProperties> = {
  root: { width: "100%", maxWidth: 440, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", fontFamily: F, color: C.parchment, position: "relative", overflow: "hidden", background: C.ink },
  woodLayer: { position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url(${WOOD})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
  ambient: { position: "fixed", inset: 0, zIndex: 1, background: "radial-gradient(120% 80% at 50% 0%, rgba(40,36,20,0.25) 0%, rgba(8,10,5,0.45) 70%, rgba(4,5,2,0.7) 100%)" },
  header: { position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "54px 24px 14px" },
  logo: { display: "flex", alignItems: "baseline" },
  logoText: { fontSize: 42, fontWeight: 400, color: C.parchment, letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  logoDot: { fontSize: 42, color: C.brass, textShadow: `0 0 20px ${C.brassGlow}` },
  tagline: { fontSize: 10, letterSpacing: "0.24em", color: C.brassSoft, marginTop: 5, opacity: 0.9 },
  avatar: { width: 46, height: 46, borderRadius: "50%", background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,240,200,0.08)" },
  screen: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 },
  navWrap: { position: "relative", zIndex: 10, background: "linear-gradient(0deg,rgba(8,10,5,0.95),rgba(8,10,5,0.8))", backdropFilter: "blur(20px)" },
  navLine: { height: 1, background: `linear-gradient(90deg,transparent,${C.brassDeep},${C.brass},${C.brassDeep},transparent)`, boxShadow: `0 0 10px ${C.brassGlow}` },
  nav: { display: "flex", padding: "10px 0 20px" },
  navBtn: { flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  arloA: { width: 20, height: 20, borderRadius: "50%", border: `1.6px solid ${C.parchmentLow}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.parchmentLow, fontFamily: F },
  arloAOn: { borderColor: C.brass, color: C.brass, boxShadow: `0 0 10px ${C.brassGlow}` },
  navLabel: { fontSize: 11, color: C.parchmentLow },
  navLabelOn: { color: C.brass },
};
const S: Record<string, CSSProperties> = {
  scroll: { flex: 1, overflowY: "auto", padding: "16px 18px 0" },
  greetRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 10 },
  greet: { fontSize: 27, fontWeight: 400, color: C.parchment, lineHeight: 1.15, textShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  greetSub: { fontSize: 14, color: C.parchmentDim, marginTop: 5 },
  dateChip: { display: "flex", alignItems: "center", background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 22, padding: "7px 13px", fontSize: 12, color: C.parchmentMid, flexShrink: 0, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" },
  verseCard: { ...glass, padding: "22px 20px", marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: `1.5px solid ${C.brass}`, boxShadow: `0 0 28px ${C.brassGlow},0 6px 22px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,240,200,0.08),-4px 0 20px ${C.brassGlow}` },
  card: { ...glass, padding: "18px 20px", marginBottom: 14 },
  cardCentered: { ...glass, padding: "22px 20px", marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  eyebrow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 12 },
  eyeText: { fontSize: 11, letterSpacing: "0.16em", color: C.brassSoft, fontWeight: 600 },
  verseText: { fontSize: 18, lineHeight: 1.6, color: C.parchment, marginBottom: 14, textAlign: "center" },
  verseRef: { fontSize: 11, letterSpacing: "0.12em", color: C.brassSoft },
  intent: { fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  intentInput: { width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontFamily: F, fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  empty: { fontSize: 13, color: C.parchmentDim, textAlign: "center", padding: "6px 0" },
  prioLine: { position: "absolute", left: 19, top: 18, bottom: 20, width: 2, background: `linear-gradient(180deg,${C.walnutLite},${C.walnut})`, boxShadow: "0 0 4px rgba(0,0,0,0.5)" },
  prioRow: { display: "flex", gap: 14, alignItems: "flex-start", position: "relative" },
  prioNum: { width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: `radial-gradient(circle at 35% 28%,${C.walnutMid},${C.walnut} 70%,#3E2814)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.parchment, boxShadow: `0 3px 10px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,220,160,0.25),inset 0 -2px 4px rgba(0,0,0,0.4),0 0 0 5px rgba(20,18,11,0.85)`, zIndex: 1, textShadow: "0 1px 2px rgba(0,0,0,0.5)", border: "none", cursor: "pointer" },
  prioTitle: { fontSize: 15, color: C.parchment, lineHeight: 1.4, marginBottom: 3 },
  prioSub: { fontSize: 12, color: C.parchmentDim, lineHeight: 1.4 },
  swipeWrap: { position: "relative", overflow: "hidden", borderRadius: 12, touchAction: "pan-y" },
  swipeFront: { background: "transparent", width: "100%" },
  deleteCue: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, background: "rgba(200,112,96,0.2)", color: "#D4A090", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  upRow: { display: "flex" },
  upCol: { flex: 1, paddingRight: 12 },
  upBorder: { borderRight: "1px solid rgba(210,190,130,0.14)", marginRight: 12 },
  upTime: { display: "flex", alignItems: "center", fontSize: 12, color: C.brassSoft, marginBottom: 6, fontWeight: 600 },
  upTitle: { fontSize: 14, color: C.parchment, marginBottom: 2, fontWeight: 600 },
  upSub: { fontSize: 11, color: C.parchmentDim, marginBottom: 8 },
  upTag: { display: "inline-block", fontSize: 9, letterSpacing: "0.1em", borderRadius: 5, padding: "3px 8px", fontWeight: 600, border: "1px solid" },
  tagWork: { color: "#A8C888", background: "rgba(120,150,90,0.18)", borderColor: "rgba(150,180,110,0.4)" },
  tagHer: { color: "#D4A090", background: "rgba(160,90,70,0.18)", borderColor: "rgba(190,120,100,0.4)" },
  journalCard: { ...glass, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 },
  journalText: { fontSize: 13, color: C.parchmentMid, marginTop: 2 },
  journalInput: { width: "100%", marginTop: 10, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: "10px 12px", outline: "none", resize: "vertical", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  exerciseCard: { ...glass, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(138,180,106,0.28)" },
  exerciseDone: { opacity: 0.72, borderColor: "rgba(138,180,106,0.42)" },
  exerciseText: { fontSize: 13, color: C.parchmentMid, lineHeight: 1.45, marginTop: -2 },
  exerciseBtn: { flexShrink: 0, background: "rgba(30,26,16,0.7)", border: "1px solid rgba(138,180,106,0.46)", borderRadius: 18, color: "#A8C888", fontSize: 12, fontWeight: 700, padding: "8px 13px", cursor: "pointer", fontFamily: F },
  exerciseBtnDone: { background: "rgba(138,180,106,0.22)", color: C.parchment },
  writeBtn: { flexShrink: 0, alignSelf: "flex-start", background: "transparent", border: `1.5px solid ${C.brass}`, borderRadius: 24, color: C.brass, fontSize: 13, fontWeight: 600, padding: "10px 18px", cursor: "pointer", boxShadow: `0 0 16px ${C.brassGlow},inset 0 0 8px rgba(216,170,62,0.1)` },
  msgBar: { display: "flex", alignItems: "center", gap: 11, background: "rgba(8,10,5,0.55)", backdropFilter: "blur(8px)", borderRadius: 30, padding: "11px 11px 11px 17px", marginBottom: 14, border: "1px solid rgba(210,190,130,0.16)", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.3)" },
  msgInput: { flex: 1, background: "none", border: "none", color: C.parchment, fontSize: 14, outline: "none", fontFamily: F },
  msgSend: { width: 36, height: 36, borderRadius: "50%", background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 12px ${C.brassGlow},inset 0 1px 0 rgba(255,240,200,0.3)` },
  micBtn: { width: 32, height: 32, borderRadius: "50%", background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.16)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" },
  micBtnOn: { background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: `1px solid ${C.brass}`, boxShadow: `0 0 14px ${C.brassGlow}`, animation: "micPulse 1s ease-in-out infinite" },
  bottomTag: { textAlign: "center", fontSize: 10, letterSpacing: "0.18em", color: C.brassSoft, opacity: 0.7, marginBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: 400, color: C.parchment, marginBottom: 4, textShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  pageSub: { fontSize: 13, color: C.parchmentDim, marginBottom: 18 },
  logRow: { display: "flex", gap: 8, marginBottom: 14 },
  logInput: { flex: 1, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: "12px 14px", outline: "none", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  logBtn: { background: `linear-gradient(135deg,${C.walnutMid},${C.walnut})`, border: "none", borderRadius: 12, color: C.parchment, fontSize: 13, fontWeight: 700, padding: "12px 18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,220,160,0.15)" },
  commitRow: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  dot: { width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: "rgba(0,0,0,0.2)", border: `1.5px solid ${C.parchmentLow}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#7AB46A", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)" },
  dotDone: { background: "rgba(120,180,106,0.25)", borderColor: "#7AB46A" },
  jobRow: { marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(210,190,130,0.12)" },
  workList: { ...glass, padding: "10px 0", marginBottom: 12 },
  workGroup: { fontSize: 10, fontWeight: 800, letterSpacing: "0.13em", padding: "8px 16px 5px" },
  workRow: { width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", alignItems: "center", background: "transparent", border: "none", borderTop: "1px solid rgba(210,190,130,0.09)", color: C.parchment, textAlign: "left", padding: "9px 16px 10px", cursor: "pointer", fontFamily: F },
  workMain: { minWidth: 0 },
  workName: { fontSize: 14, color: C.parchment, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  workMeta: { fontSize: 11, color: C.parchmentDim, lineHeight: 1.35, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  workPct: { fontSize: 12, color: C.brassSoft, fontWeight: 700, gridColumn: "2", gridRow: "1 / span 2" },
  workTrack: { gridColumn: "1 / -1", height: 3, background: "rgba(0,0,0,0.42)", borderRadius: 3, overflow: "hidden", marginTop: 6 },
  workTrackFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  jobTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  trackRow: { display: "flex", alignItems: "center", gap: 8 },
  track: { flex: 1, height: 5, background: "rgba(0,0,0,0.45)", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" },
  trackFill: { height: "100%", borderRadius: 3, transition: "width 0.4s" },
  intakeBtn: { width: "100%", borderRadius: 14, border: `1px dashed ${C.walnutLite}80`, background: "rgba(90,58,32,0.18)", color: C.parchmentMid, fontSize: 13, fontWeight: 600, padding: "15px", cursor: "pointer", fontFamily: F },
  chatWrap: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 12 },
  chatMsgs: { flex: 1, overflowY: "auto", padding: "12px 18px" },
  bubble: { marginBottom: 14, maxWidth: "86%" },
  bubbleA: { marginRight: "auto" },
  bubbleU: { marginLeft: "auto" },
  bubbleName: { fontSize: 9, letterSpacing: "0.14em", color: C.brassSoft, marginBottom: 5, fontWeight: 600 },
  bubbleText: { ...glass, padding: "13px 15px", fontSize: 14, lineHeight: 1.65, color: C.parchment, display: "inline-block", whiteSpace: "pre-wrap", borderTopLeftRadius: 5 },
  bubbleTextU: { background: `linear-gradient(135deg,${C.walnut},${C.walnutMid})`, border: `1px solid ${C.walnutLite}50`, borderTopLeftRadius: 18, borderTopRightRadius: 5 },
  chatBar: { display: "flex", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid rgba(210,190,130,0.12)", alignItems: "center" },
  calendarCard: { ...glass, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  calendarTitle: { fontSize: 14, color: C.parchment, fontWeight: 700, marginBottom: 3 },
  calendarBtn: { background: `linear-gradient(135deg,${C.walnutMid},${C.walnut})`, border: "none", borderRadius: 12, color: C.parchment, fontSize: 13, fontWeight: 700, padding: "10px 14px", cursor: "pointer", fontFamily: F, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,220,160,0.15)" },
  calendarRemoveBtn: { background: "none", border: `1px solid rgba(200,112,96,0.4)`, borderRadius: 8, color: "#C87060", fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: F, flexShrink: 0 },
  weekRow: { display: "flex", gap: 14, alignItems: "flex-start", paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid rgba(210,190,130,0.12)" },
  weekToday: { ...glass, padding: "14px", border: `1px solid ${C.brass}50`, boxShadow: `0 0 18px ${C.brassGlow}`, margin: "0 -2px 14px" },
  weekL: { width: 42, flexShrink: 0 },
  weekDay: { fontSize: 12, fontWeight: 700, color: C.parchmentMid, textTransform: "uppercase" },
  todayPill: { fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`, color: C.ink, borderRadius: 6, padding: "3px 9px", fontWeight: 700, alignSelf: "center", flexShrink: 0, boxShadow: `0 2px 8px ${C.brassGlow}` },
  weekItem: { marginBottom: 8 },
  weekItemTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  weekTime: { fontSize: 11, color: C.brassSoft, flexShrink: 0 },
  calendarBottom: { borderTop: "1px solid rgba(210,190,130,0.12)", marginTop: 8, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" },
  calendarAccount: { display: "flex", justifyContent: "space-between", alignItems: "center", color: C.parchmentDim, fontSize: 12 },
  calendarSmallBtn: { alignSelf: "stretch", background: "rgba(30,26,16,0.62)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 10, color: C.parchmentMid, fontSize: 12, fontWeight: 700, padding: "10px 12px", cursor: "pointer", fontFamily: F },
};
const M: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 200, backdropFilter: "blur(6px)" },
  sheet: { width: "100%", maxWidth: 440, margin: "0 auto", position: "relative", overflow: "hidden", background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))", backdropFilter: "blur(24px)", borderRadius: "22px 22px 0 0", padding: "24px 24px 48px", border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none", boxShadow: "0 -10px 50px rgba(0,0,0,0.7)" },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.brass},transparent)`, boxShadow: `0 0 14px ${C.brassGlow}` },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 23, color: C.parchment, fontWeight: 400 },
  track: { height: 3, background: "rgba(0,0,0,0.45)", borderRadius: 2, overflow: "hidden", marginBottom: 24 },
  fill: { height: "100%", background: `linear-gradient(90deg,${C.brassDeep},${C.brass})`, borderRadius: 2, transition: "width 0.3s", boxShadow: `0 0 7px ${C.brassGlow}` },
  q: { fontSize: 20, color: C.parchment, lineHeight: 1.4, marginBottom: 22 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  choice: { background: "rgba(34,30,18,0.9)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 14, padding: "16px", cursor: "pointer", fontFamily: F, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" },
  input: { width: "100%", background: "rgba(8,10,5,0.7)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 15, fontFamily: F, padding: "14px", outline: "none", marginBottom: 12, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  next: { width: "100%", background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`, border: "none", borderRadius: 12, color: C.ink, fontSize: 15, fontWeight: 700, padding: "15px", cursor: "pointer", marginBottom: 8, fontFamily: F, boxShadow: `0 4px 18px ${C.brassGlow}` },
  cancel: { width: "100%", background: "none", border: "none", color: C.parchmentDim, fontSize: 13, cursor: "pointer", padding: "10px", fontFamily: F },
};
const E: Record<string, CSSProperties> = {
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 11, letterSpacing: "0.1em", color: C.brassSoft, fontWeight: 600, marginBottom: 6 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, marginTop: -4 },
  chip: { background: "rgba(34,30,18,0.9)", border: "1px solid rgba(210,190,130,0.22)", borderRadius: 20, color: C.parchmentMid, fontSize: 13, padding: "7px 14px", cursor: "pointer", fontFamily: F },
  slider: { width: "100%", accentColor: C.brass, marginBottom: 12 },
};
