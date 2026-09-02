import { useState, useEffect, useRef, useCallback, useId } from "react";
import type { CSSProperties, ReactElement, ReactNode, PointerEvent } from "react";
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
interface Task {
  id: number; text: string; category: string; partial: boolean; done: boolean; notes: string;
  recurrencePeriod: "daily" | "weekly" | "monthly" | null;
  recurrenceTarget: number | null;
  completedToday: boolean;
  slipping: boolean;
}
interface TaskHistory {
  task: Task;
  completions: string[];
  streak: number;
  currentPeriod: { key: string; completedCount: number; target: number; pct: number } | null;
  completedToday: boolean;
  slipping: boolean;
}
interface Commit {
  id: number; text: string; notes: string; madeDate: string; dueDate: string | null; done: boolean;
  relationshipId: number | null; adHocName: string | null; adHocCategory: RelationshipCategory | null;
}
interface Job { id: number; biz: string; name: string; stage: string; due: string; pct: number; pursuitId: number | null; materials: string; budget: string; risk: string; }
type PursuitCategory = "job" | "business" | "volunteer" | "other";
interface Pursuit { id: number; name: string; category: PursuitCategory; notes: string; }
const PURSUIT_CATEGORIES: PursuitCategory[] = ["job", "business", "volunteer", "other"];
const PURSUIT_CATEGORY_LABEL: Record<PursuitCategory, string> = { job: "Job", business: "Business", volunteer: "Volunteer", other: "Other" };
interface Event { id: number; date: string; time: string; title: string; sub: string; tag: string; kind: string; }
interface Message { role: "user" | "assistant"; content: string; }
interface Journal { reflect: string; commit_text: string; }
type RelationshipCategory = "spouse" | "child" | "family" | "friend" | "other";
interface Relationship {
  id: number; name: string | null; category: RelationshipCategory; type: string;
  notes: string; commitments: string; biggestChallenge: string; starred: boolean; sortOrder: number | null;
}
const RELATIONSHIP_CATEGORIES: RelationshipCategory[] = ["spouse", "child", "family", "friend", "other"];
const RELATIONSHIP_CATEGORY_LABEL: Record<RelationshipCategory, string> = { spouse: "Spouse", child: "Child", family: "Family", friend: "Friend", other: "Other" };
type ToneVoice = "straight_talk" | "middle_of_the_road" | "take_it_easy";
interface ProfileData { name?: string | null; season_of_life?: string | null; voice?: ToneVoice | null; }
type PulseCategory = "physical" | "mental" | "spiritual";
type PulseState = "up" | "mid" | "down";
interface PulseCheckEntry { category: PulseCategory; state: PulseState; note: string; }
const PULSE_CATEGORIES: { id: PulseCategory; label: string }[] = [
  { id: "physical", label: "Physical" },
  { id: "mental", label: "Mental" },
  { id: "spiritual", label: "Spiritual" },
];

const TONE_LABEL: Record<ToneVoice, string> = { straight_talk: "Straight Talk", middle_of_the_road: "Middle of the Road", take_it_easy: "Take it Easy" };
function isToneVoice(v: unknown): v is ToneVoice { return v === "straight_talk" || v === "middle_of_the_road" || v === "take_it_easy"; }

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

// ── Save status (#43) ────────────────────────────────────────────────────────
// Text-field saves get the full lifecycle below — held at "saving" until the
// server actually confirms (never an optimistic "saved"), typed text always
// left exactly as entered on failure, retry only on explicit tap. Tap/toggle
// actions (mark complete, pin, delete, …) keep their existing optimistic-then-
// revert pattern and just gain a brief inline error on failure — a persistent
// "Saving…" label would be noise for a sub-second round trip.
type SaveState = "idle" | "saving" | "saved" | "error";

function useSaveStatus() {
  const [status, setStatus] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function save(fn: () => Promise<boolean>): Promise<boolean> {
    setStatus("saving");
    let ok = false;
    try { ok = await fn(); } catch { ok = false; }
    if (ok) {
      setStatus("saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
    return ok;
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setStatus("idle");
  }
  return { status, save, reset };
}

// Same lifecycle as useSaveStatus, keyed — for a list of independently
// saveable fields (Pulse Check's three notes, Journal History's per-date entries).
function useKeyedSaveStatus<K extends string>() {
  const [statuses, setStatuses] = useState<Partial<Record<K, SaveState>>>({});
  const timers = useRef<Partial<Record<K, ReturnType<typeof setTimeout>>>>({});
  useEffect(() => () => { Object.values(timers.current).forEach(t => t && clearTimeout(t as ReturnType<typeof setTimeout>)); }, []);

  async function save(key: K, fn: () => Promise<boolean>): Promise<boolean> {
    setStatuses(prev => ({ ...prev, [key]: "saving" }));
    let ok = false;
    try { ok = await fn(); } catch { ok = false; }
    if (ok) {
      setStatuses(prev => ({ ...prev, [key]: "saved" }));
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => setStatuses(prev => ({ ...prev, [key]: "idle" })), 2000);
    } else {
      setStatuses(prev => ({ ...prev, [key]: "error" }));
    }
    return ok;
  }
  function reset(key: K) {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    setStatuses(prev => ({ ...prev, [key]: "idle" }));
  }
  function get(key: K): SaveState { return statuses[key] ?? "idle"; }
  return { get, save, reset };
}

// Brief, self-clearing message for a tap/toggle action's failure — the item
// itself already reverts visually; this just says why.
function useTapError() {
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(msg: string) {
    setError(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setError(null), 3000);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { error, flash };
}

// Same as useTapError, keyed — for a list of independently tappable rows
// (Tribe's per-commitment toggle, per-relationship primary pin).
function useKeyedTapError<K extends string | number>() {
  const [errors, setErrors] = useState<Map<K, string>>(new Map());
  const timers = useRef<Map<K, ReturnType<typeof setTimeout>>>(new Map());
  function flash(key: K, msg: string) {
    setErrors(prev => new Map(prev).set(key, msg));
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(key, setTimeout(() => setErrors(prev => { const next = new Map(prev); next.delete(key); return next; }), 3000));
  }
  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)); }, []);
  function get(key: K): string | null { return errors.get(key) ?? null; }
  return { get, flash };
}

const saveStatusText: CSSProperties = { fontSize: 11.5, color: "#9C9272", marginTop: 5, fontFamily: F };
const saveStatusRetry: CSSProperties = { background: "none", border: "none", padding: 0, color: "#C89A34", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: F, textDecoration: "underline" };

function SaveStatus({ status, onRetry }: { status: SaveState; onRetry?: () => void }) {
  if (status === "idle") return null;
  if (status === "saving") return <div role="status" style={saveStatusText}>Saving…</div>;
  if (status === "saved") return <div role="status" style={{ ...saveStatusText, color: "#8FAE6E" }}>Saved</div>;
  return (
    <div role="alert" style={{ ...saveStatusText, color: "#C87060", display: "flex", alignItems: "center", gap: 6 }}>
      <span>Couldn&apos;t save</span>
      {onRetry && <button style={saveStatusRetry} onClick={onRetry}>Retry</button>}
    </div>
  );
}

// role="alert" (#36) so a screen reader announces a validation/save
// failure as it appears, the same way the visible red text draws the eye —
// shared by every TapError call site in the app.
function TapError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" style={{ fontSize: 11.5, color: "#C87060", marginTop: 4, fontFamily: F }}>{message}</div>;
}

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
  // Every icon in the app is decorative — paired with a visible label, or
  // sitting inside a button that carries its own aria-label — so it's
  // hidden from assistive tech rather than announced as an unlabeled image (#36).
  return <svg {...p} aria-hidden="true">{m[name]}</svg>;
}

const NAV: { id: TabId; icon: IconName | "stewardIcon"; label: string }[] = [
  { id: "today", icon: "sun", label: "Today" },
  { id: "her", icon: "heart", label: "Tribe" },
  { id: "work", icon: "work", label: "Work" },
  { id: "steward", icon: "stewardIcon", label: "Steward" },
  { id: "week", icon: "cal", label: "Week" },
];
type TabId = "today" | "her" | "work" | "steward" | "week";

const BIZ_PALETTE = ["#8AB46A", "#6AAEC8", "#C89840", "#B080C0", "#C87060", "#60A8B4", "#A890C0"];
function pursuitColor(pursuitId: number | null, ids: number[]) {
  const i = pursuitId === null ? -1 : ids.indexOf(pursuitId);
  return BIZ_PALETTE[i >= 0 ? i % BIZ_PALETTE.length : 0];
}

// ── Modal dialog shell (#36) ──────────────────────────────────────────────────
// Every modal in the app renders the same overlay/sheet/strip/head/title
// boilerplate by hand — this centralizes the part that needs real a11y
// behavior (dialog semantics, a labelled heading, Escape-to-close, focus
// moved in on open and restored to whatever triggered it on close) so
// every modal gets it uniformly instead of retrofitting each one by hand.
// Callers still own the overlay div (and whatever click-outside behavior
// it has, if any) — this only replaces the sheet and its header.
function ModalSheet({ title, headExtra, onClose, sheetOnClick, children }: {
  title: ReactNode; headExtra?: ReactNode; onClose: () => void;
  sheetOnClick?: (e: React.MouseEvent) => void; children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Captured during render, before this modal's own DOM (and any child
  // autoFocus field inside it) commits — an effect would run too late and
  // read the modal's own newly-focused child back as "what was focused
  // before," breaking the on-close restore for every modal with a
  // pre-focused field.
  const [previouslyFocused] = useState<HTMLElement | null>(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    // A child field with autoFocus may have already claimed focus in this
    // same commit — respect it instead of yanking focus back to the sheet.
    if (!sheetRef.current?.contains(document.activeElement)) {
      sheetRef.current?.focus();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    // onClose is re-created per render in most callers (inline arrow) — keying
    // this on mount only avoids tearing down/rebuilding focus state every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={sheetRef} style={M.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={sheetOnClick}>
      <div style={M.strip} />
      <div style={M.head}><div style={M.title} id={titleId}>{title}</div>{headExtra}</div>
      {children}
    </div>
  );
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


const JOURNAL_PROMPTS_MARRIED = [
  "What's one specific way I can love my spouse better today?",
  "Where do my kids need patience, attention, or encouragement from me today?",
  "What's been bothering me that I need to name honestly instead of carrying quietly?",
  "What am I thankful for today, and how can I say it out loud?",
  "What would make my spouse feel seen before the day is over?",
  "What's one small moment I can create with my kids today?",
  "Where am I tempted to withdraw, and what would love do instead?",
];

const JOURNAL_PROMPTS_EMPTY_NESTER = [
  "Which coworker or teammate could use more of my real attention today?",
  "Who at work have I been too busy or too guarded to really see lately?",
  "What's one specific way I can check in on my kids without hovering?",
  "What's been bothering me that I need to name honestly instead of carrying quietly?",
  "What am I thankful for today, and how can I say it out loud?",
  "Where am I tempted to withdraw, and what would love do instead?",
  "Who could use an encouraging word from me before the day is over?",
];

const JOURNAL_PROMPTS_GENERAL = [
  "Who in my life could use a real conversation today, not just a text?",
  "Where do the people closest to me need patience, attention, or encouragement today?",
  "What's been bothering me that I need to name honestly instead of carrying quietly?",
  "What am I thankful for today, and how can I say it out loud?",
  "Who could use an encouraging word from me before the day is over?",
  "What's one small moment of real connection I can create today?",
  "Where am I tempted to withdraw, and what would love do instead?",
];

function seasonCategory(profile: ProfileData | null, relationships: Relationship[]): "married" | "empty_nester" | "general" {
  const season = (profile?.season_of_life || "").toLowerCase();
  if (season.includes("empty nest")) return "empty_nester";
  if (season.includes("married") || relationships.some(r => r.category === "spouse")) return "married";
  return "general";
}

function journalPromptsFor(profile: ProfileData | null, relationships: Relationship[]): string[] {
  const category = seasonCategory(profile, relationships);
  if (category === "married") return JOURNAL_PROMPTS_MARRIED;
  if (category === "empty_nester") return JOURNAL_PROMPTS_EMPTY_NESTER;
  return JOURNAL_PROMPTS_GENERAL;
}

function primaryRelationship(relationships: Relationship[]): Relationship | null {
  // The list arrives pre-sorted (starred first, in their own manual/default
  // order, then unstarred the same way) — Today's Intention is just
  // whoever sorts first among the starred, or the overall top of the list
  // if nobody's starred (#65).
  return relationships.find(r => r.starred) ?? relationships[0] ?? null;
}

function dayOfYear(date = new Date()) {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
}

function rotatingItem(items: string[]) {
  return items[dayOfYear() % items.length];
}

const PRIORITIES_VISIBLE_CAP = 3;
const KEPT_VISIBLE_CAP = 10;

function cadenceLabel(t: Task): string {
  if (!t.recurrencePeriod) return "";
  if (t.recurrencePeriod === "daily") return "Daily";
  const n = t.recurrenceTarget ?? 1;
  const unit = t.recurrencePeriod === "weekly" ? "week" : "month";
  return n <= 1 ? `Once a ${unit}` : `${n}x/${unit}`;
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

function jobCalendarEvent(job: Job, pursuitName: string): Event | null {
  const date = parseJobDueDate(job.due);
  if (!date) return null;
  return {
    id: -100000 - job.id,
    date,
    time: "Due",
    title: job.name,
    sub: job.stage,
    tag: pursuitName,
    kind: "work",
  };
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { isLoading, isAuthenticated, pendingApproval, user, login, logout, startEmailLogin, verifyEmailLogin } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("today");

  const [verse, setVerse] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [journal, setJournal] = useState<Journal>({ reflect: "", commit_text: "" });
  const [commits, setCommits] = useState<Commit[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [today, setToday] = useState<Event[]>([]);
  const [week, setWeek] = useState<Event[]>([]);
  const [chat, setChat] = useState<Message[]>([]);
  const [pulseChecks, setPulseChecks] = useState<PulseCheckEntry[]>([]);

  const [ci, setCi] = useState("");
  const [sending, setSending] = useState(false);
  const [jobModal, setJobModal] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [pursuitModal, setPursuitModal] = useState(false);
  const [editPursuit, setEditPursuit] = useState<Pursuit | null>(null);
  const [closedPursuitsOpen, setClosedPursuitsOpen] = useState(false);
  const [closePursuitPrompt, setClosePursuitPrompt] = useState<Pursuit | null>(null);
  const [calendarAccounts, setCalendarAccounts] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [priorityDetail, setPriorityDetail] = useState<Task | null>(null);
  const [completedLogOpen, setCompletedLogOpen] = useState(false);
  const [journalHistoryOpen, setJournalHistoryOpen] = useState(false);
  const [suggestedTone, setSuggestedTone] = useState<ToneVoice | null>(null);

  async function setTone(voice: ToneVoice) {
    setProfile(p => ({ ...(p ?? {}), voice }));
    setSuggestedTone(null);
    try {
      await fetch(`${API}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice }) });
    } catch { /* optimistic update already applied; a stale read on next load self-corrects */ }
  }

  const refreshTasks = useCallback(() => {
    return getList<Task>(`${API}/tasks?today=${ymd(new Date())}`).then(setTasks);
  }, []);
  const refreshCommits = useCallback(() => {
    return getList<Commit>(`${API}/commits`).then(setCommits);
  }, []);
  const refreshRelationships = useCallback(() => {
    getList<Relationship>(`${API}/relationships`).then(setRelationships);
  }, []);
  const refreshJobs = useCallback(() => {
    getList<Job>(`${API}/jobs`).then(setJobs);
  }, []);
  const refreshPursuits = useCallback(() => {
    getList<Pursuit>(`${API}/pursuits`).then(setPursuits);
  }, []);
  // After a job save, check whether it just became the last incomplete job
  // in its pursuit — if so, surface the auto-close prompt (#48). Re-fetches
  // jobs directly rather than trusting `jobs` state, which is still stale
  // at the moment the save that triggered this resolves.
  const maybePromptPursuitClose = useCallback(async (pursuitId: number | null) => {
    if (pursuitId === null) return;
    const freshJobs = await getList<Job>(`${API}/jobs`);
    setJobs(freshJobs);
    const pursuitJobs = freshJobs.filter(j => j.pursuitId === pursuitId);
    if (pursuitJobs.length === 0 || !pursuitJobs.every(j => j.pct === 100)) return;
    const pursuit = pursuits.find(p => p.id === pursuitId);
    if (pursuit) setClosePursuitPrompt(pursuit);
  }, [pursuits]);
  const refreshCalendarStatus = useCallback(() => {
    getJson(`${API}/google-calendar/status`, { accounts: [] }).then((d) => {
      setCalendarAccounts(isRecord(d) && Array.isArray(d.accounts) ? d.accounts as string[] : isRecord(d) && d.connected ? ["Google Calendar"] : []);
    });
  }, []);
  const refreshPulseChecks = useCallback(() => {
    getList<PulseCheckEntry>(`${API}/pulse-checks?date=${ymd(new Date())}`).then(setPulseChecks);
  }, []);
  const refreshJournal = useCallback(() => {
    getJson(`${API}/journal`, null).then((d) => { if (isRecord(d)) setJournal({ reflect: String(d.reflect || ""), commit_text: String(d.commitText ?? d.commit_text ?? "") }); });
  }, []);

  async function savePulseCheck(category: PulseCategory, state: PulseState, note: string): Promise<boolean> {
    try {
      const r = await fetch(`${API}/pulse-checks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ymd(new Date()), category, state, note }),
      });
      if (r.ok) {
        setPulseChecks(prev => [...prev.filter(p => p.category !== category), { category, state, note }]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

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
    refreshJournal();
    getList<Event>(`${API}/coming-up`).then(setToday);
    getList<Event>(`${API}/coming-up?start=${start}&end=${end}`).then(setWeek);
    getList<Message>(`${API}/chat-history`).then((m) => setChat(prev => prev.length ? prev : m));
    getJson(`${API}/admin/is-admin`, { isAdmin: false }).then((d) => setIsAdmin(isRecord(d) && d.isAdmin === true));
    getJson(`${API}/profile`, null).then((d) => { if (isRecord(d) && isRecord(d.data)) setProfile(d.data as unknown as ProfileData); });
    refreshTasks(); refreshCommits(); refreshJobs(); refreshCalendarStatus(); refreshPulseChecks(); refreshRelationships(); refreshPursuits();
  }, [isAuthenticated, setLocation, refreshTasks, refreshCommits, refreshJobs, refreshCalendarStatus, refreshPulseChecks, refreshRelationships, refreshPursuits, refreshJournal]);

  async function saveJournal(next: Journal): Promise<boolean> {
    try {
      const r = await fetch(`${API}/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (r.ok) { setJournal(next); return true; }
      return false;
    } catch {
      return false;
    }
  }

  async function send(msg?: string) {
    const text = (msg ?? ci).trim();
    if (!text || sending) return;
    setCi("");
    if (tab !== "steward") setTab("steward");
    setChat(p => [...p, { role: "user", content: text }]);
    setSending(true);
    setSuggestedTone(null);
    try {
      const r = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (r.ok) {
        const d = await r.json();
        setChat(p => [...p, { role: "assistant", content: d.message }]);
        setSuggestedTone(isToneVoice(d.suggestTone) ? d.suggestTone : null);
      } else {
        // 504 means the server's own OpenAI call timed out (#68) — a real,
        // distinct-from-generic-failure response, not a network drop, so it
        // gets its own friendly message instead of the raw status/body dump.
        const timedOut = r.status === 504;
        const assistantText = timedOut
          ? "Steward is taking longer than usual to respond. Try again in a moment."
          : "Steward is connected, but the chat request failed (" + r.status + "): " + ((await r.text()) || "No error details returned.");
        setChat(p => [...p, { role: "assistant", content: assistantText }]);
        // Restore the typed message instead of losing it (#67) — the input
        // was cleared optimistically above before the request even went out.
        setCi(text);
      }
    } catch {
      setChat(p => [...p, { role: "assistant", content: "I couldn't reach the server just now. Try again in a moment." }]);
      setCi(text);
    } finally {
      setSending(false);
    }
  }

  if (!isAuthenticated) return <AuthGate loading={isLoading} pendingApproval={pendingApproval} onLogin={login} onStartEmailLogin={startEmailLogin} onVerifyEmailLogin={verifyEmailLogin} />;

  const primaryRel = primaryRelationship(relationships);

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
          <button style={{ ...R.avatar, padding: 0, cursor: "pointer" }} onClick={() => setProfileMenu(true)} title="Profile" aria-label="Profile"><Icon name="user" size={20} color={C.parchmentDim} /></button>
        </div>
      </div>

      <div style={R.screen}>
        {tab === "today" && <Today verse={verse} tasks={tasks} journal={journal} events={today} name={user?.firstName} profile={profile} relationships={relationships} primaryRel={primaryRel} onSend={send} ci={ci} setCi={setCi} sending={sending} onSaveJournal={saveJournal} refreshTasks={refreshTasks} onOpenPriority={setPriorityDetail} onViewCompleted={() => setCompletedLogOpen(true)} pulseChecks={pulseChecks} onSavePulseCheck={savePulseCheck} onOpenJournalHistory={() => setJournalHistoryOpen(true)} />}
        {tab === "her" && <Relationships relationships={relationships} refreshRelationships={refreshRelationships} commits={commits} refreshCommits={refreshCommits} />}
        {tab === "work" && <Work jobs={jobs} pursuits={pursuits} onJob={() => setJobModal(true)} onEdit={setEditJob} onAddPursuit={() => setPursuitModal(true)} onEditPursuit={setEditPursuit} onOpenClosed={() => setClosedPursuitsOpen(true)} />}
        {tab === "steward" && <StewardChat messages={chat} input={ci} setInput={setCi} send={() => send()} sending={sending} tasks={tasks} onOpenPriority={setPriorityDetail} tone={profile?.voice ?? "straight_talk"} onSetTone={setTone} suggestedTone={suggestedTone} />}
        {tab === "week" && <WeekView events={week} jobs={jobs} pursuits={pursuits} calendarAccounts={calendarAccounts} onConnectCalendar={() => { window.location.href = `${API}/google-calendar/connect`; }} onDisconnectCalendar={async (email) => { try { await fetch(`${API}/google-calendar/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); refreshCalendarStatus(); } catch { /* ignore */ } }} />}
      </div>

      <div style={R.navWrap}>
        <div style={R.navLine} />
        <nav style={R.nav} aria-label="Main">
          {NAV.map(n => (
            <button key={n.id} style={R.navBtn} onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined}>
              {n.icon === "stewardIcon"
                ? <div style={{ ...R.stewardIcon, ...(tab === n.id ? R.stewardIconOn : {}) }} aria-hidden="true">S</div>
                : <Icon name={n.icon as IconName} size={20} color={tab === n.id ? C.brass : C.parchmentLow} stroke={tab === n.id ? 1.9 : 1.6} />}
              <span style={{ ...R.navLabel, ...(tab === n.id ? R.navLabelOn : {}) }}>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {jobModal && <JobModal pursuits={pursuits} onClose={() => setJobModal(false)} onCreated={refreshJobs} />}
      {editJob && <JobEditModal job={editJob} pursuits={pursuits} onClose={() => setEditJob(null)} onSaved={maybePromptPursuitClose} onDeleted={refreshJobs} />}
      {pursuitModal && <PursuitModal onClose={() => setPursuitModal(false)} onSaved={refreshPursuits} />}
      {editPursuit && <PursuitModal pursuit={editPursuit} onClose={() => setEditPursuit(null)} onSaved={refreshPursuits} onDeleted={() => { refreshPursuits(); refreshJobs(); }} onClosed={refreshPursuits} />}
      {closedPursuitsOpen && <PursuitsClosedModal onClose={() => setClosedPursuitsOpen(false)} onChanged={refreshPursuits} />}
      {closePursuitPrompt && (
        <PursuitCloseFinishedPrompt
          pursuit={closePursuitPrompt}
          onClose={() => setClosePursuitPrompt(null)}
          onClosed={() => { setClosePursuitPrompt(null); refreshPursuits(); }}
        />
      )}
      {profileMenu && <ProfileMenu name={user?.firstName} email={user?.email} onClose={() => setProfileMenu(false)} onLogout={logout} />}
      {priorityDetail && <PriorityDetailModal task={priorityDetail} onClose={() => setPriorityDetail(null)} onChanged={refreshTasks} />}
      {completedLogOpen && <CompletedLogModal onClose={() => setCompletedLogOpen(false)} onChanged={refreshTasks} />}
      {journalHistoryOpen && <JournalHistoryModal onClose={() => setJournalHistoryOpen(false)} onSaved={refreshJournal} />}
    </div>
  );
}

function ProfileMenu({ name, email, onClose, onLogout }: { name?: string | null; email?: string | null; onClose: () => void; onLogout: () => void }) {
  return (
    <div style={M.overlay} onClick={onClose}>
      <ModalSheet title={name || email || "Profile"} onClose={onClose} sheetOnClick={e => e.stopPropagation()}>
        <a style={{ ...M.next, textDecoration: "none", display: "block", textAlign: "center" }} href="mailto:admin@lucasalign.com?subject=Steward%20feedback">Contact Support / Feedback</a>
        <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentDim, boxShadow: "none" }} onClick={onLogout}>Log Out</button>
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────
function Today({ verse, tasks, journal, events, name, profile, relationships, primaryRel, onSend, ci, setCi, sending, onSaveJournal, refreshTasks, onOpenPriority, onViewCompleted, pulseChecks, onSavePulseCheck, onOpenJournalHistory }: {
  verse: string; tasks: Task[]; journal: Journal; events: Event[]; name?: string | null;
  profile: ProfileData | null; relationships: Relationship[]; primaryRel: Relationship | null;
  onSend: (m?: string) => void; ci: string; setCi: (v: string) => void; sending: boolean;
  onSaveJournal: (j: Journal) => Promise<boolean>; refreshTasks: () => void;
  onOpenPriority: (t: Task) => void; onViewCompleted: () => void;
  pulseChecks: PulseCheckEntry[]; onSavePulseCheck: (category: PulseCategory, state: PulseState, note: string) => Promise<boolean>;
  onOpenJournalHistory: () => void;
}) {
  const [intent, setIntent] = useState(journal.commit_text);
  const [reflect, setReflect] = useState(journal.reflect);
  const [writing, setWriting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [prioritiesExpanded, setPrioritiesExpanded] = useState(false);
  const introSave = useSaveStatus();
  const reflectSave = useSaveStatus();
  const addTaskSave = useSaveStatus();
  useEffect(() => { setIntent(journal.commit_text); setReflect(journal.reflect); }, [journal.commit_text, journal.reflect]);

  const hr = new Date().getHours();
  const greeting = `Good ${hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening"}${name ? `, ${name}` : ""}.`;
  const sep = verse.indexOf(" — ");
  const vRef = sep === -1 ? "" : verse.slice(0, sep);
  const vText = sep === -1 ? verse : verse.slice(sep + 3);
  const openTasks = tasks.filter(t => !deletingIds.includes(t.id));
  const visibleTasks = prioritiesExpanded ? openTasks : openTasks.slice(0, PRIORITIES_VISIBLE_CAP);
  const hiddenTaskCount = openTasks.length - visibleTasks.length;
  const journalPrompt = rotatingItem(journalPromptsFor(profile, relationships));
  const isSpouseRel = primaryRel?.category === "spouse";
  const intentionLabel = isSpouseRel ? "MARRIAGE INTENTION" : primaryRel ? `${(primaryRel.type || "relationship").toUpperCase()} INTENTION` : "RELATIONSHIP INTENTION";
  const intentionPlaceholder = isSpouseRel
    ? "What's your intention for your marriage today?"
    : primaryRel?.name
      ? `What's your intention with ${primaryRel.name} today?`
      : "What's your intention for the people who matter most today?";

  async function addTask() {
    const t = newTask.trim();
    if (!t) return;
    const ok = await addTaskSave.save(async () => {
      const r = await fetch(`${API}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      if (r.ok) refreshTasks();
      return r.ok;
    });
    if (ok) { setNewTask(""); setAdding(false); }
  }
  async function complete(id: number): Promise<boolean> {
    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
      if (r.ok) refreshTasks();
      return r.ok;
    } catch {
      return false;
    }
  }
  async function deleteTask(id: number): Promise<boolean> {
    setDeletingIds(prev => prev.includes(id) ? prev : [...prev, id]);
    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
      if (r.ok) {
        await refreshTasks();
        // Deletes are soft now (#54) — the id must be un-hidden once the
        // refreshed list lands, or a later Reopen from the Deleted list
        // fetches the task back as open but this stale id keeps hiding it.
        setDeletingIds(prev => prev.filter(item => item !== id));
        return true;
      }
      setDeletingIds(prev => prev.filter(item => item !== id));
      return false;
    } catch {
      setDeletingIds(prev => prev.filter(item => item !== id));
      return false;
    }
  }
  async function logToday(id: number): Promise<boolean> {
    try {
      const r = await fetch(`${API}/tasks/${id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ymd(new Date()) }),
      });
      if (r.ok) refreshTasks();
      return r.ok;
    } catch {
      return false;
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
        <div style={S.eyebrow}><Icon name="heart" /><span style={S.eyeText}>{intentionLabel}</span></div>
        <textarea
          style={S.intentInput}
          value={intent}
          rows={2}
          placeholder={intentionPlaceholder}
          onChange={e => { setIntent(e.target.value); if (introSave.status === "error") introSave.reset(); }}
          onBlur={() => { if (intent !== journal.commit_text) introSave.save(() => onSaveJournal({ ...journal, commit_text: intent })); }}
        />
        <SaveStatus status={introSave.status} onRetry={() => introSave.save(() => onSaveJournal({ ...journal, commit_text: intent }))} />
      </div>

      <PulseCheckCard pulseChecks={pulseChecks} onSave={onSavePulseCheck} />

      <div style={S.card}>
        <div style={S.prioHeadRow}>
          <div style={S.eyebrow}><Icon name="target" /><span style={S.eyeText}>PRIORITIES</span></div>
          <button style={S.prioLogLink} onClick={onViewCompleted}>View completed ›</button>
        </div>
        {openTasks.length === 0 ? (
          <div style={S.empty}>No open priorities. Add the one thing that matters most.</div>
        ) : (
          <>
            <div style={{ position: "relative", marginTop: 4 }}>
              <div style={S.prioLine} />
              {visibleTasks.map((t, i) => (
                <SwipePriority key={t.id} task={t} index={i} isLast={i === visibleTasks.length - 1} onComplete={complete} onDelete={deleteTask} onLogToday={logToday} onOpenDetail={onOpenPriority} />
              ))}
            </div>
            {openTasks.length > PRIORITIES_VISIBLE_CAP && (
              <button style={S.prioExpandBtn} onClick={() => setPrioritiesExpanded(e => !e)}>
                {prioritiesExpanded ? "Show less ▴" : `Show ${hiddenTaskCount} more ▾`}
              </button>
            )}
          </>
        )}
        {adding ? (
          <div style={{ marginTop: 14, marginBottom: 0 }}>
            <div style={S.logRow}>
              <input
                style={S.logInput} value={newTask} autoFocus placeholder="One thing that moves it forward…"
                onChange={e => { setNewTask(e.target.value); if (addTaskSave.status === "error") addTaskSave.reset(); }}
                onKeyDown={e => { if (e.key === "Enter") addTask(); }}
              />
              <button style={S.logBtn} onClick={addTask}>Add</button>
            </div>
            <SaveStatus status={addTaskSave.status} onRetry={addTask} />
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
          <div style={S.prioHeadRow}>
            <div style={S.eyebrow}><Icon name="pen" /><span style={S.eyeText}>DAILY JOURNAL PROMPT</span></div>
            <button style={S.prioLogLink} onClick={onOpenJournalHistory}>History ›</button>
          </div>
          <div style={S.journalText}>{journalPrompt}</div>
          {writing && (
            <>
              <textarea
                style={S.journalInput}
                value={reflect}
                rows={3}
                autoFocus
                placeholder="Write your reflection…"
                onChange={e => { setReflect(e.target.value); if (reflectSave.status === "error") reflectSave.reset(); }}
                onBlur={() => { if (reflect !== journal.reflect) reflectSave.save(() => onSaveJournal({ ...journal, reflect })); }}
              />
              <SaveStatus status={reflectSave.status} onRetry={() => reflectSave.save(() => onSaveJournal({ ...journal, reflect }))} />
            </>
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

const PULSE_STATE_COLOR: Record<PulseState, string> = { down: "#C87060", mid: C.brassSoft, up: "#8FAE6E" };
// Empty/half/full fuel gauge — #44's chosen icon direction. Both the outline
// and the fill level use currentColor so the icon automatically picks up the
// button's own active/inactive color, same as the plain-text glyph it replaces.
const PULSE_GAUGE_FILL: Record<PulseState, { y: number; h: number }> = {
  down: { y: 19, h: 5 },
  mid: { y: 13, h: 11 },
  up: { y: 8, h: 16 },
};
function PulseGaugeIcon({ state }: { state: PulseState }) {
  const { y, h } = PULSE_GAUGE_FILL[state];
  return (
    <svg viewBox="0 0 20 28" width="22" height="22" style={{ display: "block" }}>
      <rect x="6" y="1" width="8" height="4" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1" y="5" width="18" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y={y} width="12" height={h} rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PulseCheckCard({ pulseChecks, onSave }: {
  pulseChecks: PulseCheckEntry[];
  onSave: (category: PulseCategory, state: PulseState, note: string) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Partial<Record<PulseCategory, string>>>({});
  const [pendingState, setPendingState] = useState<Partial<Record<PulseCategory, PulseState>>>({});
  const { error: tapError, flash } = useTapError();
  const noteSave = useKeyedSaveStatus<PulseCategory>();
  const byCategory = new Map(pulseChecks.map(p => [p.category, p]));

  async function tapState(category: PulseCategory, state: PulseState) {
    const existing = byCategory.get(category);
    setPendingState(prev => ({ ...prev, [category]: state }));
    const ok = await onSave(category, state, existing?.note ?? "");
    setPendingState(prev => { const next = { ...prev }; delete next[category]; return next; });
    if (!ok) flash("Couldn't save — try again");
  }
  function saveNote(category: PulseCategory, entry: PulseCheckEntry) {
    const note = drafts[category] ?? entry.note;
    if (note === entry.note) return;
    noteSave.save(category, () => onSave(category, entry.state, note));
  }

  return (
    <div style={S.card}>
      <div style={S.eyebrow}><Icon name="sun" /><span style={S.eyeText}>PULSE CHECK</span></div>
      <div style={S.pulseSub}>How are you holding up?</div>
      {PULSE_CATEGORIES.map(({ id, label }) => {
        const entry = byCategory.get(id);
        const displayState = pendingState[id] ?? entry?.state;
        return (
          <div key={id} style={S.pulseRow}>
            <div style={S.pulseRowTop}>
              <div style={S.pulseLabel}>{label}</div>
              <div style={S.pulseBtns}>
                {(["down", "mid", "up"] as PulseState[]).map(s => (
                  <button
                    key={s}
                    style={{ ...S.pulseBtn, width: 46, height: 46, ...(displayState === s ? { borderColor: PULSE_STATE_COLOR[s], color: PULSE_STATE_COLOR[s], boxShadow: `0 0 8px ${PULSE_STATE_COLOR[s]}55` } : {}) }}
                    onClick={() => tapState(id, s)}
                    aria-label={`${label}: ${s}`}
                  >
                    <PulseGaugeIcon state={s} />
                  </button>
                ))}
              </div>
            </div>
            {entry && (
              <>
                <input
                  style={S.pulseNoteInput}
                  value={drafts[id] ?? entry.note}
                  placeholder="Add a note (optional)…"
                  onChange={e => { setDrafts(prev => ({ ...prev, [id]: e.target.value })); if (noteSave.get(id) === "error") noteSave.reset(id); }}
                  onBlur={() => saveNote(id, entry)}
                />
                <SaveStatus status={noteSave.get(id)} onRetry={() => saveNote(id, entry)} />
              </>
            )}
          </div>
        );
      })}
      <TapError message={tapError} />
    </div>
  );
}

const SWIPE_REVEAL_WIDTH = 104;
const SWIPE_REVEAL_THRESHOLD = 56;

// Shared swipe-to-reveal gesture physics — left reveals a red action, right
// (when allowed) reveals a green one. Releasing the swipe never fires
// anything by itself; it only snaps open to reveal the button, which needs
// its own deliberate tap (#54). Pure gesture state only — callers own what
// the two actions are and how they render.
function useSwipeReveal(canSwipeRight: boolean) {
  const [startX, setStartX] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const baseOffset = useRef(0);
  const lastMove = useRef<{ x: number; t: number } | null>(null);
  const velocity = useRef(0); // px/ms — drives how quickly the swipe cue snaps/fades on release

  function down(e: PointerEvent<HTMLDivElement>) {
    setStartX(e.clientX);
    baseOffset.current = offset;
    lastMove.current = { x: e.clientX, t: e.timeStamp };
    velocity.current = 0;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (startX === null) return;
    const maxRight = canSwipeRight ? SWIPE_REVEAL_WIDTH : 0;
    const next = Math.min(maxRight, Math.max(-SWIPE_REVEAL_WIDTH, baseOffset.current + (e.clientX - startX)));
    setOffset(next);
    if (lastMove.current) {
      const dt = Math.max(1, e.timeStamp - lastMove.current.t);
      const dx = Math.abs(e.clientX - lastMove.current.x);
      velocity.current = Math.min(3, dx / dt);
    }
    lastMove.current = { x: e.clientX, t: e.timeStamp };
  }
  function up() {
    if (startX === null) return;
    if (offset <= -SWIPE_REVEAL_THRESHOLD) setOffset(-SWIPE_REVEAL_WIDTH);
    else if (offset >= SWIPE_REVEAL_THRESHOLD) setOffset(SWIPE_REVEAL_WIDTH);
    else setOffset(0);
    setStartX(null);
    setDragging(false);
  }
  function close() { setOffset(0); }

  // A fast flick settles/fades in almost instantly; a slow drag eases in —
  // the fade speed tracks how fast the row was actually swiped.
  const fadeMs = Math.round(Math.max(70, 260 - velocity.current * 90));
  const cueTransition = dragging ? "none" : `opacity ${fadeMs}ms ease`;
  const leftOpacity = Math.min(1, Math.max(0, -offset) / SWIPE_REVEAL_WIDTH);
  const rightOpacity = Math.min(1, Math.max(0, offset) / SWIPE_REVEAL_WIDTH);
  const rowTransition = dragging ? "none" : "transform 0.18s ease";

  return { offset, dragging, down, move, up, close, leftOpacity, rightOpacity, cueTransition, rowTransition };
}

function SwipePriority({ task, index, isLast, onComplete, onDelete, onLogToday, onOpenDetail }: {
  task: Task; index: number; isLast: boolean;
  onComplete: (id: number) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onLogToday: (id: number) => Promise<boolean>;
  onOpenDetail: (task: Task) => void;
}) {
  const [crossedOff, setCrossedOff] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { error, flash } = useTapError();
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const canSwipeComplete = !crossedOff && !completing && (task.recurrencePeriod ? !task.completedToday : true);
  const swipe = useSwipeReveal(canSwipeComplete);

  async function tapNumber() {
    if (task.recurrencePeriod) {
      if (task.completedToday) return;
      setPulsed(true);
      const ok = await onLogToday(task.id);
      if (!ok) { setPulsed(false); flash("Couldn't save — try again"); }
    } else if (!confirming) {
      // One-off priorities need a second tap to confirm (#45) — recurring
      // "log today" taps stay single-tap since they're not a final done.
      setConfirming(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
    } else {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirming(false);
      setCrossedOff(true);
      setTimeout(async () => {
        const ok = await onComplete(task.id);
        if (!ok) { setCrossedOff(false); flash("Couldn't save — try again"); }
      }, 260);
    }
  }

  // Swipe-revealed actions require a deliberate tap on the button — swiping
  // alone never deletes or completes anything, it only reveals the control.
  async function runDelete() {
    if (deleting) return;
    setDeleting(true);
    const ok = await onDelete(task.id);
    if (!ok) { setDeleting(false); swipe.close(); flash("Couldn't delete — try again"); }
  }
  async function runComplete() {
    if (!canSwipeComplete) return;
    setCompleting(true);
    swipe.close();
    if (task.recurrencePeriod) {
      setPulsed(true);
      const ok = await onLogToday(task.id);
      setCompleting(false);
      if (!ok) { setPulsed(false); flash("Couldn't save — try again"); }
    } else {
      setCrossedOff(true);
      setTimeout(async () => {
        const ok = await onComplete(task.id);
        setCompleting(false);
        if (!ok) { setCrossedOff(false); flash("Couldn't save — try again"); }
      }, 260);
    }
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (deleting || completing || crossedOff) return;
    swipe.down(e);
  }

  const numDone = task.recurrencePeriod ? (task.completedToday || pulsed) : crossedOff;

  // Every row carries a status color, not just flagged ones: yellow (still
  // moving) is the default, red is stuck/slipping, green is "done" — either
  // a recurring priority completed today, or a one-off flashing green in the
  // moment it's crossed off, just before it leaves the list.
  const statusColor: "yellow" | "red" | "green" = crossedOff
    ? "green"
    : task.partial || (Boolean(task.recurrencePeriod) && task.slipping)
    ? "red"
    : task.recurrencePeriod && task.completedToday
    ? "green"
    : "yellow";
  const rowStyle = statusColor === "red" ? S.prioRowRed : statusColor === "green" ? S.prioRowGreen : S.prioRowYellow;
  const subStyle = statusColor === "red" ? S.prioSubRed : statusColor === "green" ? S.prioSubGreen : S.prioSub;
  const subText = confirming
    ? "Tap again to mark done"
    : task.partial
    ? "Stuck — needs a nudge"
    : task.recurrencePeriod && task.slipping
    ? "Streak broke — needs a nudge"
    : task.recurrencePeriod && task.completedToday
    ? "Completed today ✓"
    : task.recurrencePeriod
    ? cadenceLabel(task)
    : task.category;

  return (
    <div style={{ ...S.swipeWrap, marginBottom: isLast ? 0 : 20 }}>
      <button
        style={{ ...S.deleteCue, opacity: swipe.leftOpacity, transition: swipe.cueTransition, pointerEvents: swipe.offset < 0 ? "auto" : "none" }}
        disabled={deleting} onClick={runDelete}
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button
        style={{ ...S.completeCue, opacity: swipe.rightOpacity, transition: swipe.cueTransition, pointerEvents: swipe.offset > 0 ? "auto" : "none" }}
        disabled={completing} onClick={runComplete}
      >
        {completing ? "…" : "Complete"}
      </button>
      <div
        style={{ ...S.prioRow, ...S.swipeFront, ...rowStyle, transform: "translateX(" + swipe.offset + "px)", transition: swipe.rowTransition }}
        onPointerDown={down}
        onPointerMove={swipe.move}
        onPointerUp={swipe.up}
        onPointerCancel={swipe.up}
      >
        <button
          style={{ ...S.prioNum, ...(numDone ? S.prioNumDone : {}), ...(confirming ? { borderColor: C.brass, color: C.brass, boxShadow: `0 0 8px ${C.brassGlow}` } : {}) }}
          title={task.recurrencePeriod ? "Complete for today" : confirming ? "Tap again to confirm" : "Mark done"}
          onClick={tapNumber}
          disabled={crossedOff || (task.recurrencePeriod ? task.completedToday || pulsed : false)}
        >
          {confirming ? "✓" : index + 1}
        </button>
        <div style={{ flex: 1, paddingTop: 3, opacity: crossedOff ? 0.45 : 1, transition: "opacity 0.2s ease" }}>
          <div style={{ ...S.prioTitle, textDecoration: crossedOff ? "line-through" : "none", transition: "text-decoration-color 0.2s ease" }}>{task.text}</div>
          {subText && <div style={confirming ? { ...S.prioSub, color: C.brass } : subStyle}>{subText}</div>}
        </div>
        <button style={S.prioEditBtn} title="Edit" onClick={() => onOpenDetail(task)}>Edit</button>
      </div>
      <TapError message={error} />
    </div>
  );
}

function TodayMsgBar({ ci, setCi, sending, onSend }: { ci: string; setCi: (v: string) => void; sending: boolean; onSend: (m?: string) => void }) {
  const { listening, toggle } = useSpeech(setCi);
  return (
    <div style={S.msgBar}>
      <Icon name="chat" size={17} color={C.parchmentLow} />
      <input style={S.msgInput} value={ci} onChange={e => setCi(e.target.value)} onKeyDown={e => e.key === "Enter" && onSend()} placeholder="Message Steward..." aria-label="Message Steward" />
      <button style={{ ...S.micBtn, ...(listening ? S.micBtnOn : {}) }} onClick={toggle} title={listening ? "Stop" : "Voice input"} aria-label={listening ? "Stop voice input" : "Voice input"}>
        <Icon name="mic" size={15} color={listening ? C.ink : C.parchmentDim} stroke={1.8} />
      </button>
      <button style={S.msgSend} disabled={sending} onClick={() => onSend()} aria-label="Send message"><Icon name="send" size={16} color={C.ink} /></button>
    </div>
  );
}

// ── Relationships ─────────────────────────────────────────────────────────────
function relationshipLabel(r: Relationship): string {
  return r.name || r.type || RELATIONSHIP_CATEGORY_LABEL[r.category];
}

// A commitment's target is either an existing Tribe relationship, or a
// one-time ad hoc name + category (#60) — never neither.
function commitTargetLabel(c: Commit, byId: Map<number, Relationship>): string {
  if (c.relationshipId && byId.has(c.relationshipId)) return relationshipLabel(byId.get(c.relationshipId)!);
  if (c.adHocName) return c.adHocName;
  return "someone";
}
function commitTargetSub(c: Commit, byId: Map<number, Relationship>): string {
  if (c.relationshipId && byId.has(c.relationshipId)) {
    const r = byId.get(c.relationshipId)!;
    return RELATIONSHIP_CATEGORY_LABEL[r.category];
  }
  if (c.adHocCategory) return RELATIONSHIP_CATEGORY_LABEL[c.adHocCategory];
  return "";
}
// [OVERDUE] / [DUE SOON] / [aging with no due date] — mirrors Steward's own
// read of the same fields (stewardContext.ts) so the UI and the chat agree.
function commitAgeStatus(c: Commit): { label: string; color: "red" | "brass" | null } {
  if (c.dueDate) {
    const dueInDays = Math.round((new Date(c.dueDate).getTime() - new Date(ymd(new Date())).getTime()) / 86400000);
    if (dueInDays < 0) return { label: "Overdue", color: "red" };
    if (dueInDays <= 3) return { label: dueInDays === 0 ? "Due today" : `Due in ${dueInDays}d`, color: "brass" };
    return { label: `Due ${c.dueDate}`, color: null };
  }
  return { label: "", color: null };
}

// A commitment row: compact by default (text, who, made-date), with an
// expand toggle revealing notes/due date and an Edit button. Swipe
// left/right works on the collapsed row regardless of expand state —
// reusing the same gesture as Priorities (#54), red reveals Delete, green
// reveals Kept. Marking Kept has no confirm step (#60/Q3): unlike a
// priority, toggling a commitment is already freely reversible.
function SwipeCommitment({ commit, byId, onToggleDone, onDelete, onEdit }: {
  commit: Commit; byId: Map<number, Relationship>;
  onToggleDone: (id: number, done: boolean) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onEdit: (commit: Commit) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { error, flash } = useTapError();
  const swipe = useSwipeReveal(!commit.done && !toggling);

  async function runToggle() {
    if (toggling || deleting) return;
    setToggling(true);
    swipe.close();
    const ok = await onToggleDone(commit.id, !commit.done);
    setToggling(false);
    if (!ok) flash("Couldn't save — try again");
  }
  async function runDelete() {
    if (deleting) return;
    setDeleting(true);
    const ok = await onDelete(commit.id);
    if (!ok) { setDeleting(false); swipe.close(); flash("Couldn't delete — try again"); }
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (deleting || toggling) return;
    swipe.down(e);
  }

  const who = commitTargetLabel(commit, byId);
  const sub = commitTargetSub(commit, byId);
  const age = commit.done ? { label: "", color: null as "red" | "brass" | null } : commitAgeStatus(commit);
  const ageColor = age.color === "red" ? "#C87060" : age.color === "brass" ? C.brass : C.parchmentDim;

  return (
    <div style={{ ...S.swipeWrap, marginBottom: 12 }}>
      <button
        style={{ ...S.deleteCue, opacity: swipe.leftOpacity, transition: swipe.cueTransition, pointerEvents: swipe.offset < 0 ? "auto" : "none" }}
        disabled={deleting} onClick={runDelete}
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {!commit.done && (
        <button
          style={{ ...S.completeCue, opacity: swipe.rightOpacity, transition: swipe.cueTransition, pointerEvents: swipe.offset > 0 ? "auto" : "none" }}
          disabled={toggling} onClick={runToggle}
        >
          {toggling ? "…" : "Kept"}
        </button>
      )}
      <div
        style={{ ...S.commitCard, transform: "translateX(" + swipe.offset + "px)", transition: swipe.rowTransition }}
        onPointerDown={down} onPointerMove={swipe.move} onPointerUp={swipe.up} onPointerCancel={swipe.up}
      >
        <div style={{ ...S.commitRow, marginBottom: 0 }}>
          <button style={{ ...S.dot, ...(commit.done ? S.dotDone : {}) }} disabled={toggling} onClick={runToggle} aria-label={commit.done ? "Reopen" : "Mark kept"}>
            {commit.done ? "✓" : ""}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ ...S.prioTitle, textDecoration: commit.done ? "line-through" : "none" }}>{commit.text}</div>
            <div style={S.prioSub}>
              For {who}{sub ? ` (${sub})` : ""} · Said {commit.madeDate}
              {age.label && <span style={{ color: ageColor, marginLeft: 6 }}>{age.label}</span>}
            </div>
          </div>
          <button style={S.commitExpandBtn} onClick={() => setExpanded(e => !e)} aria-label={expanded ? "Show less" : "Show more"}>
            {expanded ? "▴" : "▾"}
          </button>
        </div>
        {expanded && (
          <div style={S.commitExpandPanel}>
            {commit.notes && <div style={S.prioSub}>Note: {commit.notes}</div>}
            {commit.dueDate && <div style={S.prioSub}>Due {commit.dueDate}</div>}
            <button style={S.prioEditBtn} onClick={() => onEdit(commit)}>Edit</button>
          </div>
        )}
      </div>
      <TapError message={error} />
    </div>
  );
}

// One row in the People list: drag handle, star (pin to top), name/category
// — tapping the name opens the edit modal. Extracted so DraggableRelationshipList
// only has to know about dragging, not what a person looks like.
function PersonRow({ r, dragProps, onToggleStar, onEdit, error }: {
  r: Relationship; dragProps: { onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void };
  onToggleStar: () => void; onEdit: () => void; error: string | null;
}) {
  return (
    <div>
      <div style={S.tribeRow}>
        <button style={S.dragHandle} {...dragProps} aria-label="Drag to reorder">⠿</button>
        <button
          style={{ ...S.pulseBtn, ...(r.starred ? { borderColor: C.brass, color: C.brass, boxShadow: `0 0 8px ${C.brassGlow}` } : {}) }}
          onClick={onToggleStar} aria-label={r.starred ? "Unstar" : "Star — pin to top"}
        >★</button>
        <button style={S.tribeNameBtn} onClick={onEdit}>
          <div style={S.prioTitle}>{relationshipLabel(r)}</div>
          <div style={S.prioSub}>{RELATIONSHIP_CATEGORY_LABEL[r.category]}{r.type && r.type !== r.category ? ` — ${r.type}` : ""}</div>
        </button>
      </div>
      <TapError message={error} />
    </div>
  );
}

// A press-and-drag reorderable list, scoped to one starred/unstarred group
// (#65) — dragging never needs to cross groups since each instance only
// ever holds one group's rows. Rows swap live as the dragged row crosses a
// neighbor's position; the parent only hears about the final order, on
// release, and owns saving it.
function DraggableRelationshipList({ items, onReorder, renderRow }: {
  items: Relationship[];
  onReorder: (orderedIds: number[]) => void;
  renderRow: (r: Relationship, dragHandleProps: { onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void }) => ReactNode;
}) {
  const [order, setOrder] = useState<Relationship[]>(items);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const startY = useRef(0);
  const startIndex = useRef(0);

  // The prop is the source of truth whenever nothing's being dragged right
  // now — keeps this in sync with server data (e.g. after adding someone).
  useEffect(() => { if (draggingId === null) setOrder(items); }, [items, draggingId]);

  function down(id: number, e: PointerEvent<HTMLButtonElement>) {
    const idx = order.findIndex(r => r.id === id);
    if (idx === -1) return;
    startY.current = e.clientY;
    startIndex.current = idx;
    setDraggingId(id);
    setDragOffset(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (draggingId === null) return;
    const dy = e.clientY - startY.current;
    setDragOffset(dy);
    const draggedEl = rowRefs.current.get(draggingId);
    if (!draggedEl) return;
    const rowHeight = draggedEl.offsetHeight || 1;
    const idx = order.findIndex(r => r.id === draggingId);
    const targetIndex = Math.max(0, Math.min(order.length - 1, startIndex.current + Math.round(dy / rowHeight)));
    if (targetIndex !== idx) {
      setOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(idx, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      startY.current = e.clientY;
      startIndex.current = targetIndex;
      setDragOffset(0);
    }
  }
  function up() {
    if (draggingId === null) return;
    setDraggingId(null);
    setDragOffset(0);
    onReorder(order.map(r => r.id));
  }

  return (
    <div onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {order.map(r => (
        <div
          key={r.id}
          ref={el => { if (el) rowRefs.current.set(r.id, el); else rowRefs.current.delete(r.id); }}
          style={{
            position: "relative",
            zIndex: draggingId === r.id ? 2 : 1,
            transform: draggingId === r.id ? `translateY(${dragOffset}px)` : "none",
            transition: draggingId === r.id ? "none" : "transform 0.15s ease",
            boxShadow: draggingId === r.id ? "0 6px 16px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {renderRow(r, { onPointerDown: (e) => down(r.id, e) })}
        </div>
      ))}
    </div>
  );
}

function Relationships({ relationships, refreshRelationships, commits, refreshCommits }: {
  relationships: Relationship[]; refreshRelationships: () => void;
  commits: Commit[]; refreshCommits: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Relationship | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [editingCommit, setEditingCommit] = useState<Commit | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deletedPeopleOpen, setDeletedPeopleOpen] = useState(false);
  const resetSave = useSaveStatus();
  const primaryTapError = useKeyedTapError<number>();
  const { error: orderError, flash: flashOrderError } = useTapError();
  const primaryRel = primaryRelationship(relationships);
  const byId = new Map(relationships.map(r => [r.id, r]));
  const starredPeople = relationships.filter(r => r.starred);
  const unstarredPeople = relationships.filter(r => !r.starred);
  const intentionText = primaryRel?.name
    ? `Ask ${primaryRel.name} about their week before you talk about yours.`
    : "Log commitments to the people who matter most — spouse, kids, parents, close friends.";
  const open = commits.filter(c => !c.done && !deletingIds.includes(c.id));
  const done = commits.filter(c => c.done && !deletingIds.includes(c.id));

  async function setCommitDone(id: number, doneVal: boolean): Promise<boolean> {
    try {
      const r = await fetch(`${API}/commits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: doneVal }) });
      if (r.ok) { refreshCommits(); return true; }
    } catch { /* fall through */ }
    return false;
  }
  async function deleteCommit(id: number): Promise<boolean> {
    setDeletingIds(prev => prev.includes(id) ? prev : [...prev, id]);
    try {
      const r = await fetch(`${API}/commits/${id}`, { method: "DELETE" });
      if (r.ok) {
        await refreshCommits();
        setDeletingIds(prev => prev.filter(item => item !== id));
        return true;
      }
      setDeletingIds(prev => prev.filter(item => item !== id));
      return false;
    } catch {
      setDeletingIds(prev => prev.filter(item => item !== id));
      return false;
    }
  }
  async function toggleStarred(r: Relationship) {
    try {
      const res = await fetch(`${API}/relationships/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: !r.starred }) });
      if (res.ok) { refreshRelationships(); return; }
    } catch { /* fall through */ }
    primaryTapError.flash(r.id, "Couldn't save — try again");
  }
  async function reorderGroup(starred: boolean, orderedIds: number[]) {
    try {
      const res = await fetch(`${API}/relationships/reorder`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred, orderedIds }),
      });
      if (res.ok) { refreshRelationships(); return; }
    } catch { /* fall through */ }
    flashOrderError("Couldn't save the new order — try again");
  }
  async function resetPeopleOrder() {
    await resetSave.save(async () => {
      const r = await fetch(`${API}/relationships/reset`, { method: "POST" });
      if (r.ok) { refreshRelationships(); setResetConfirmOpen(false); return true; }
      return false;
    });
  }

  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Tribe</div>
      <div style={S.pageSub}>The people you're prioritizing.</div>
      <div style={S.card}><div style={S.eyebrow}><Icon name="heart" /><span style={S.eyeText}>TODAY'S INTENTION</span></div><div style={S.intent}>{intentionText}</div></div>

      <div style={S.card}>
        <div style={S.prioHeadRow}>
          <div style={S.eyebrow}><span style={S.eyeText}>PEOPLE</span></div>
          <div>
            {relationships.length > 0 && <button style={S.prioLogLink} onClick={() => setResetConfirmOpen(true)}>Reset order</button>}
            <button style={{ ...S.prioLogLink, marginLeft: 12 }} onClick={() => setDeletedPeopleOpen(true)}>Deleted ›</button>
          </div>
        </div>
        <TapError message={orderError} />
        {relationships.length === 0 ? (
          <div style={S.empty}>No one added yet.</div>
        ) : (
          <>
            {starredPeople.length > 0 && (
              <DraggableRelationshipList
                items={starredPeople}
                onReorder={ids => reorderGroup(true, ids)}
                renderRow={(r, dragProps) => (
                  <PersonRow r={r} dragProps={dragProps} onToggleStar={() => toggleStarred(r)} onEdit={() => setEditing(r)} error={primaryTapError.get(r.id)} />
                )}
              />
            )}
            {starredPeople.length > 0 && unstarredPeople.length > 0 && <div style={S.peopleDivider} />}
            {unstarredPeople.length > 0 && (
              <DraggableRelationshipList
                items={unstarredPeople}
                onReorder={ids => reorderGroup(false, ids)}
                renderRow={(r, dragProps) => (
                  <PersonRow r={r} dragProps={dragProps} onToggleStar={() => toggleStarred(r)} onEdit={() => setEditing(r)} error={primaryTapError.get(r.id)} />
                )}
              />
            )}
          </>
        )}
        <button style={{ ...S.intakeBtn, marginTop: 14 }} onClick={() => setAddOpen(true)}>＋  Add person</button>
      </div>
      {resetConfirmOpen && (
        <div style={M.overlay}>
          <ModalSheet title="Reset People Order?" onClose={() => setResetConfirmOpen(false)}>
            <div style={{ ...S.prioSub, marginBottom: 18 }}>This clears your custom order and stars — People goes back to spouse, then children, pinned at the top.</div>
            <SaveStatus status={resetSave.status} onRetry={resetPeopleOrder} />
            <button style={{ ...M.next, background: "#C87060" }} disabled={resetSave.status === "saving"} onClick={resetPeopleOrder}>
              {resetSave.status === "saving" ? "Resetting…" : "Reset order"}
            </button>
            <button style={M.cancel} onClick={() => setResetConfirmOpen(false)}>Cancel</button>
          </ModalSheet>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
        <button style={S.prioLogLink} onClick={() => setHistoryOpen(true)}>Kept &amp; Deleted history ›</button>
      </div>
      <button style={{ ...S.intakeBtn, marginBottom: 4 }} onClick={() => setLogOpen(true)}>＋  Log a commitment</button>

      {open.length > 0 && (
        <div style={S.card}>
          <div style={S.eyebrow}><span style={S.eyeText}>OPEN</span></div>
          <div style={S.scrollCap5}>
            {open.map(c => (
              <SwipeCommitment key={c.id} commit={c} byId={byId} onToggleDone={setCommitDone} onDelete={deleteCommit} onEdit={setEditingCommit} />
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.85 }}>
          <div style={S.eyebrow}><span style={S.eyeText}>KEPT</span></div>
          {done.slice(0, KEPT_VISIBLE_CAP).map(c => (
            <SwipeCommitment key={c.id} commit={c} byId={byId} onToggleDone={setCommitDone} onDelete={deleteCommit} onEdit={setEditingCommit} />
          ))}
        </div>
      )}
      {addOpen && <RelationshipModal onClose={() => setAddOpen(false)} onSaved={refreshRelationships} />}
      {editing && <RelationshipModal relationship={editing} onClose={() => setEditing(null)} onSaved={refreshRelationships} onDeleted={() => { refreshRelationships(); refreshCommits(); }} />}
      {logOpen && <CommitLogModal relationships={relationships} onClose={() => setLogOpen(false)} onSaved={refreshCommits} onRelationshipAdded={refreshRelationships} />}
      {editingCommit && (
        <CommitEditModal
          commit={editingCommit} relationships={relationships}
          onClose={() => setEditingCommit(null)} onSaved={refreshCommits}
          onDeleted={refreshCommits} onRelationshipAdded={refreshRelationships}
        />
      )}
      {historyOpen && <CommitHistoryModal commits={done} byId={byId} onClose={() => setHistoryOpen(false)} onChanged={refreshCommits} />}
      {deletedPeopleOpen && <PeopleDeletedModal onClose={() => setDeletedPeopleOpen(false)} onChanged={refreshRelationships} />}
      {commits.length === 0 && <div style={{ ...S.card }}><div style={S.empty}>No commitments logged yet.</div></div>}
      <div style={{ height: 32 }} />
    </div>
  );
}

// Shared "who is this to?" picker used by both the log and edit modals:
// pick an existing Tribe relationship, or name someone new under a category
// and choose whether it's a one-time thing or worth adding to Tribe (#60).
function CommitTargetPicker({ relationships, relationshipId, setRelationshipId, newCategory, setNewCategory, newName, setNewName, addToTribe, setAddToTribe }: {
  relationships: Relationship[];
  relationshipId: string; setRelationshipId: (v: string) => void;
  newCategory: RelationshipCategory | ""; setNewCategory: (v: RelationshipCategory | "") => void;
  newName: string; setNewName: (v: string) => void;
  addToTribe: boolean; setAddToTribe: (v: boolean) => void;
}) {
  const hasNew = newCategory !== "" && newName.trim() !== "";
  function pickExisting(id: number) {
    setRelationshipId(String(id));
    setNewCategory(""); setNewName(""); setAddToTribe(false);
  }
  function pickNewCategory(cat: RelationshipCategory) {
    setNewCategory(cat);
    setRelationshipId("");
  }
  return (
    <>
      <div style={E.fieldGroup}>
        <div style={E.label}>WHO IS THIS TO?</div>
        {relationships.length > 0 && (
          <div style={E.chipRow}>
            {relationships.map(r => (
              <button key={r.id} style={{ ...E.chip, ...(relationshipId === String(r.id) ? { background: C.brass, color: C.ink } : {}) }} onClick={() => pickExisting(r.id)}>
                {relationshipLabel(r)}
              </button>
            ))}
          </div>
        )}
        <div style={{ ...S.prioSub, marginTop: relationships.length > 0 ? 10 : 0, marginBottom: 6 }}>Someone new:</div>
        <div style={E.chipRow}>
          {RELATIONSHIP_CATEGORIES.map(cat => (
            <button key={cat} style={{ ...E.chip, ...(newCategory === cat ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => pickNewCategory(cat)}>
              {RELATIONSHIP_CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>
        {newCategory !== "" && (
          <input style={{ ...M.input, marginTop: 8 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Their name" autoFocus />
        )}
      </div>
      {hasNew && (
        <div style={E.fieldGroup}>
          <div style={E.label}>ONE-TIME, OR ADD TO YOUR TRIBE LIST?</div>
          <div style={E.chipRow}>
            <button style={{ ...E.chip, ...(!addToTribe ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setAddToTribe(false)}>Just this once</button>
            <button style={{ ...E.chip, ...(addToTribe ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setAddToTribe(true)}>Add to Tribe</button>
          </div>
        </div>
      )}
    </>
  );
}

async function createAdHocRelationship(name: string, category: RelationshipCategory): Promise<number | null> {
  const r = await fetch(`${API}/relationships`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, category, type: "", notes: "", commitments: "", biggestChallenge: "" }),
  });
  if (!r.ok) return null;
  const created = await r.json();
  return created.id ?? null;
}

// ── Log a commitment modal ──────────────────────────────────────────────────
function CommitLogModal({ relationships, onClose, onSaved, onRelationshipAdded }: {
  relationships: Relationship[]; onClose: () => void; onSaved: () => void; onRelationshipAdded: () => void;
}) {
  const [relationshipId, setRelationshipId] = useState("");
  const [newCategory, setNewCategory] = useState<RelationshipCategory | "">("");
  const [newName, setNewName] = useState("");
  const [addToTribe, setAddToTribe] = useState(false);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const saveStatus = useSaveStatus();

  const hasExisting = relationshipId !== "";
  const hasNew = newCategory !== "" && newName.trim() !== "";
  const canSave = text.trim() !== "" && (hasExisting || hasNew);

  async function save() {
    if (!canSave) return;
    await saveStatus.save(async () => {
      let targetRelationshipId: number | null = hasExisting ? Number(relationshipId) : null;
      if (!hasExisting && hasNew && addToTribe) {
        targetRelationshipId = await createAdHocRelationship(newName.trim(), newCategory as RelationshipCategory);
        if (targetRelationshipId === null) return false;
      }
      const body: Record<string, unknown> = { text: text.trim(), notes: notes.trim(), dueDate: dueDate || null };
      if (targetRelationshipId) body.relationshipId = targetRelationshipId;
      else { body.adHocName = newName.trim(); body.adHocCategory = newCategory; }
      const r = await fetch(`${API}/commits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        if (targetRelationshipId && addToTribe) onRelationshipAdded();
        onSaved(); onClose();
        return true;
      }
      return false;
    });
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Log a Commitment" onClose={onClose}>
        <CommitTargetPicker
          relationships={relationships}
          relationshipId={relationshipId} setRelationshipId={setRelationshipId}
          newCategory={newCategory} setNewCategory={setNewCategory}
          newName={newName} setNewName={setNewName}
          addToTribe={addToTribe} setAddToTribe={setAddToTribe}
        />

        <div style={E.fieldGroup}>
          <div style={E.label}>WHAT DID YOU COMMIT TO?</div>
          <input style={M.input} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Get him in touch with my pastor" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>NOTE (OPTIONAL)</div>
          <textarea style={M.input} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any detail worth remembering" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>DUE DATE (OPTIONAL)</div>
          <input type="date" style={M.input} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={!canSave || saveStatus.status === "saving"} onClick={save}>
          {saveStatus.status === "saving" ? "Saving…" : "Log commitment"}
        </button>
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// ── Edit commitment modal ───────────────────────────────────────────────────
function CommitEditModal({ commit, relationships, onClose, onSaved, onDeleted, onRelationshipAdded }: {
  commit: Commit; relationships: Relationship[];
  onClose: () => void; onSaved: () => void; onDeleted: () => void; onRelationshipAdded: () => void;
}) {
  const [relationshipId, setRelationshipId] = useState(commit.relationshipId ? String(commit.relationshipId) : "");
  const [newCategory, setNewCategory] = useState<RelationshipCategory | "">(commit.relationshipId ? "" : (commit.adHocCategory ?? ""));
  const [newName, setNewName] = useState(commit.relationshipId ? "" : (commit.adHocName ?? ""));
  const [addToTribe, setAddToTribe] = useState(false);
  const [text, setText] = useState(commit.text);
  const [notes, setNotes] = useState(commit.notes);
  const [dueDate, setDueDate] = useState(commit.dueDate ?? "");
  const saveStatus = useSaveStatus();
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  const hasExisting = relationshipId !== "";
  const hasNew = newCategory !== "" && newName.trim() !== "";
  const canSave = text.trim() !== "" && (hasExisting || hasNew);

  async function save() {
    if (!canSave) return;
    await saveStatus.save(async () => {
      let targetRelationshipId: number | null = hasExisting ? Number(relationshipId) : null;
      if (!hasExisting && hasNew && addToTribe) {
        targetRelationshipId = await createAdHocRelationship(newName.trim(), newCategory as RelationshipCategory);
        if (targetRelationshipId === null) return false;
      }
      const body: Record<string, unknown> = { text: text.trim(), notes: notes.trim(), dueDate: dueDate || null };
      if (targetRelationshipId) body.relationshipId = targetRelationshipId;
      else { body.adHocName = newName.trim(); body.adHocCategory = newCategory; }
      const r = await fetch(`${API}/commits/${commit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        if (targetRelationshipId && addToTribe) onRelationshipAdded();
        onSaved(); onClose();
        return true;
      }
      return false;
    });
  }

  async function del() {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/commits/${commit.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted(); onClose(); }
      else { setDelErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setDelErr("Couldn't reach the server."); setDeleting(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Edit Commitment" onClose={onClose}>
        <CommitTargetPicker
          relationships={relationships}
          relationshipId={relationshipId} setRelationshipId={setRelationshipId}
          newCategory={newCategory} setNewCategory={setNewCategory}
          newName={newName} setNewName={setNewName}
          addToTribe={addToTribe} setAddToTribe={setAddToTribe}
        />

        <div style={E.fieldGroup}>
          <div style={E.label}>WHAT DID YOU COMMIT TO?</div>
          <input style={M.input} value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>NOTE (OPTIONAL)</div>
          <textarea style={M.input} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>DUE DATE (OPTIONAL)</div>
          <input type="date" style={M.input} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={!canSave || saveStatus.status === "saving"} onClick={save}>
          {saveStatus.status === "saving" ? "Saving…" : "Save"}
        </button>
        <TapError message={delErr} />
        <button style={{ ...M.cancel, color: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Delete commitment"}</button>
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// ── Kept & Deleted commitments history modal ────────────────────────────────
function CommitHistoryModal({ commits, byId, onClose, onChanged }: {
  commits: Commit[]; byId: Map<number, Relationship>; onClose: () => void; onChanged: () => void;
}) {
  const [deleted, setDeleted] = useState<Commit[] | null>(null);
  const [reopeningIds, setReopeningIds] = useState<number[]>([]);
  const reopenError = useKeyedTapError<number>();

  const load = useCallback(() => {
    fetch(`${API}/commits/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Shared by both lists — "done: false" reopens a kept commitment,
  // "deleted: false" restores a deleted one.
  async function reopen(id: number, body: { done: boolean } | { deleted: boolean }) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await fetch(`${API}/commits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        setDeleted(prev => prev && "deleted" in body ? prev.filter(c => c.id !== id) : prev);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setReopeningIds(prev => prev.filter(item => item !== id));
    reopenError.flash(id, "Couldn't reopen — try again");
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Kept Commitments" onClose={onClose}>
        <div style={S.scrollCap5}>
          {commits.map(c => (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#A8C888", fontSize: 14, lineHeight: 1.4 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.prioTitle, textDecoration: "line-through" }}>{c.text}</div>
                  <div style={S.prioSub}>For {commitTargetLabel(c, byId)} · Said {c.madeDate}</div>
                </div>
                <button style={S.prioLogLink} disabled={reopeningIds.includes(c.id)} onClick={() => reopen(c.id, { done: false })}>
                  {reopeningIds.includes(c.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              <TapError message={reopenError.get(c.id)} />
            </div>
          ))}
          {commits.length === 0 && <div style={S.empty}>Nothing kept yet.</div>}
        </div>

        <div style={{ ...E.label, marginTop: 22, marginBottom: 8 }}>DELETED</div>
        <div style={S.scrollCap5}>
          {(deleted ?? []).map(c => (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#C87060", fontSize: 14, lineHeight: 1.4 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.prioTitle, textDecoration: "line-through" }}>{c.text}</div>
                  <div style={S.prioSub}>For {commitTargetLabel(c, byId)} · Said {c.madeDate}</div>
                </div>
                <button style={S.prioLogLink} disabled={reopeningIds.includes(c.id)} onClick={() => reopen(c.id, { deleted: false })}>
                  {reopeningIds.includes(c.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              <TapError message={reopenError.get(c.id)} />
            </div>
          ))}
          {deleted && deleted.length === 0 && <div style={S.empty}>Nothing deleted.</div>}
        </div>

        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Relationship add/edit modal ────────────────────────────────────────────────
function RelationshipModal({ relationship, onClose, onSaved, onDeleted }: {
  relationship?: Relationship; onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const [name, setName] = useState(relationship?.name ?? "");
  const [category, setCategory] = useState<RelationshipCategory>(relationship?.category ?? "family");
  const [type, setType] = useState(relationship?.type ?? "");
  const [notes, setNotes] = useState(relationship?.notes ?? "");
  const [commitments, setCommitments] = useState(relationship?.commitments ?? "");
  const [biggestChallenge, setBiggestChallenge] = useState(relationship?.biggestChallenge ?? "");
  const saveStatus = useSaveStatus();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function save() {
    const body = { name: name.trim() || null, category, type: type.trim(), notes: notes.trim(), commitments: commitments.trim(), biggestChallenge: biggestChallenge.trim() };
    await saveStatus.save(async () => {
      const r = relationship
        ? await fetch(`${API}/relationships/${relationship.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`${API}/relationships`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { onSaved(); onClose(); return true; }
      return false;
    });
  }

  async function del() {
    if (!relationship) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/relationships/${relationship.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted?.(); onClose(); }
      else { setDelErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setDelErr("Couldn't reach the server."); setDeleting(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title={relationship ? "Edit Person" : "Add Person"} onClose={onClose}>
        <div style={E.fieldGroup}>
          <div style={E.label}>Name</div>
          <input style={M.input} value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Category</div>
          <div style={E.chipRow}>
            {RELATIONSHIP_CATEGORIES.map(c => (
              <button key={c} style={{ ...E.chip, ...(category === c ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setCategory(c)}>{RELATIONSHIP_CATEGORY_LABEL[c]}</button>
            ))}
          </div>
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Description</div>
          <input style={M.input} value={type} onChange={e => setType(e.target.value)} placeholder="e.g. wife, oldest son, college roommate" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Notes</div>
          <input style={M.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context worth remembering" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Commitments</div>
          <input style={M.input} value={commitments} onChange={e => setCommitments(e.target.value)} placeholder="What you've committed to" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Biggest challenge</div>
          <input style={M.input} value={biggestChallenge} onChange={e => setBiggestChallenge(e.target.value)} placeholder="Where it's hardest right now" />
        </div>

        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={saveStatus.status === "saving"} onClick={save}>{saveStatus.status === "saving" ? "Saving…" : "Save"}</button>
        <TapError message={delErr || null} />
        {relationship && confirmingDelete && (
          <div style={{ ...S.prioSub, color: "#C87060", margin: "6px 0" }}>
            Delete {relationshipLabel(relationship)}? They'll move to Deleted, where you can bring them back.
          </div>
        )}
        {relationship && (confirmingDelete ? (
          <>
            <button style={{ ...M.next, background: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Yes, delete"}</button>
            <button style={M.cancel} disabled={deleting} onClick={() => setConfirmingDelete(false)}>Cancel</button>
          </>
        ) : (
          <button style={{ ...M.cancel, color: "#C87060" }} onClick={() => setConfirmingDelete(true)}>Delete Person</button>
        ))}
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// Deleted-people view (#64) — reactivate brings someone back into the
// starred/unstarred group they left (insertIntoOrderedGroup on the server
// slots them back into rank position); permanently deleting is a second,
// separately-confirmed step since — unlike everything else in this app —
// it can't be undone.
function PeopleDeletedModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [deleted, setDeleted] = useState<Relationship[] | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [confirmPermanentId, setConfirmPermanentId] = useState<number | null>(null);
  const rowError = useKeyedTapError<number>();

  const load = useCallback(() => {
    fetch(`${API}/relationships/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reactivate(id: number) {
    setBusyIds(prev => [...prev, id]);
    try {
      const r = await fetch(`${API}/relationships/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
      if (r.ok) {
        setDeleted(prev => prev ? prev.filter(p => p.id !== id) : prev);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setBusyIds(prev => prev.filter(item => item !== id));
    rowError.flash(id, "Couldn't bring them back — try again");
  }

  async function permanentlyDelete(id: number) {
    setBusyIds(prev => [...prev, id]);
    try {
      const r = await fetch(`${API}/relationships/${id}/permanent`, { method: "DELETE" });
      if (r.ok) {
        setDeleted(prev => prev ? prev.filter(p => p.id !== id) : prev);
        setConfirmPermanentId(null);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setBusyIds(prev => prev.filter(item => item !== id));
    setConfirmPermanentId(null);
    rowError.flash(id, "Couldn't permanently delete — try again");
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Deleted People" onClose={onClose}>
        <div style={S.scrollCap5}>
          {(deleted ?? []).map(p => (
            <div key={p.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.prioTitle}>{relationshipLabel(p)}</div>
                  <div style={S.prioSub}>{RELATIONSHIP_CATEGORY_LABEL[p.category]}{p.type && p.type !== p.category ? ` — ${p.type}` : ""}</div>
                </div>
                <button style={S.prioLogLink} disabled={busyIds.includes(p.id)} onClick={() => reactivate(p.id)}>
                  {busyIds.includes(p.id) ? "Restoring…" : "Reactivate"}
                </button>
              </div>
              {confirmPermanentId === p.id ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ ...S.prioSub, color: "#C87060", marginBottom: 6 }}>
                    Permanently delete {relationshipLabel(p)}? This can't be undone.
                  </div>
                  <button style={{ ...S.prioLogLink, color: "#C87060" }} disabled={busyIds.includes(p.id)} onClick={() => permanentlyDelete(p.id)}>
                    {busyIds.includes(p.id) ? "Deleting…" : "Yes, permanently delete"}
                  </button>
                  <button style={{ ...S.prioLogLink, marginLeft: 12 }} disabled={busyIds.includes(p.id)} onClick={() => setConfirmPermanentId(null)}>Cancel</button>
                </div>
              ) : (
                <button style={{ ...S.prioLogLink, color: "#C87060", marginTop: 4 }} onClick={() => setConfirmPermanentId(p.id)}>Delete permanently</button>
              )}
              <TapError message={rowError.get(p.id)} />
            </div>
          ))}
          {deleted && deleted.length === 0 && <div style={S.empty}>No one deleted.</div>}
        </div>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Work ───────────────────────────────────────────────────────────────────
function Work({ jobs, pursuits, onJob, onEdit, onAddPursuit, onEditPursuit, onOpenClosed }: {
  jobs: Job[]; pursuits: Pursuit[]; onJob: () => void; onEdit: (j: Job) => void;
  onAddPursuit: () => void; onEditPursuit: (p: Pursuit) => void; onOpenClosed: () => void;
}) {
  const pursuitIds = pursuits.map(p => p.id);
  const jobsByPursuit = new Map<number | null, Job[]>();
  for (const j of jobs) {
    const key = j.pursuitId;
    if (!jobsByPursuit.has(key)) jobsByPursuit.set(key, []);
    jobsByPursuit.get(key)!.push(j);
  }
  for (const list of jobsByPursuit.values()) list.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  const unsorted = jobsByPursuit.get(null) ?? [];

  function renderJobRow(j: Job, color: string) {
    return (
      <button key={j.id} style={S.workRow} onClick={() => onEdit(j)}>
        <div style={S.workMain}>
          <div style={S.workName}>{j.name}</div>
          <div style={S.workMeta}>{[j.stage, j.due].filter(Boolean).join("  •  ") || "No stage or due date"}</div>
        </div>
        <div style={S.workPct}>{j.pct}%</div>
        <div style={S.workTrack}><div style={{ ...S.workTrackFill, width: j.pct + "%", background: j.pct >= 80 ? C.brass : color }} /></div>
      </button>
    );
  }

  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Work</div>
      <div style={S.pageSub}>Active jobs by pursuit. Tap a row to edit.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
        <button style={S.prioLogLink} onClick={onOpenClosed}>Closed ›</button>
      </div>
      {pursuits.length === 0 && jobs.length === 0 ? (
        <div style={S.card}><div style={S.empty}>No pursuits yet. Add one to start planning ahead.</div></div>
      ) : (
        <div style={S.workList}>
          {pursuits.map(p => {
            const color = pursuitColor(p.id, pursuitIds);
            const pursuitJobs = jobsByPursuit.get(p.id) ?? [];
            return (
              <div key={p.id}>
                <button style={{ ...S.workGroup, color, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onEditPursuit(p)}>
                  {p.name.toUpperCase()}
                </button>
                {pursuitJobs.length === 0
                  ? <div style={{ ...S.empty, textAlign: "left", padding: "0 0 10px" }}>No jobs yet.</div>
                  : pursuitJobs.map(j => renderJobRow(j, color))}
              </div>
            );
          })}
          {unsorted.length > 0 && (
            <div>
              <div style={S.workGroup}>UNSORTED</div>
              {unsorted.map(j => renderJobRow(j, C.parchmentLow))}
            </div>
          )}
        </div>
      )}
      <button style={{ ...S.intakeBtn, marginTop: 12 }} onClick={onAddPursuit}>＋  Add pursuit</button>
      <button style={{ ...S.intakeBtn, marginTop: 8 }} onClick={onJob}>＋  Add new job</button>
      <div style={{ height: 32 }} />
    </div>
  );
}

// ── Steward chat ────────────────────────────────────────────────────────────
function tasksMentionedIn(content: string, tasks: Task[]): Task[] {
  const lower = content.toLowerCase();
  return tasks.filter(t => t.text.trim().length > 3 && lower.includes(t.text.trim().toLowerCase()));
}

function StewardChat({ messages, input, setInput, send, sending, tasks, onOpenPriority, tone, onSetTone, suggestedTone }: {
  messages: Message[]; input: string; setInput: (v: string) => void; send: () => void; sending: boolean; tasks: Task[]; onOpenPriority: (t: Task) => void;
  tone: ToneVoice; onSetTone: (t: ToneVoice) => void; suggestedTone: ToneVoice | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <div style={S.chatWrap}>
      <div style={{ padding: "4px 18px 0" }}>
        <div style={S.pageTitle}>Steward</div>
        <div style={S.pageSub}>Your partner, bringing just the truth.</div>
        <div style={S.toneRow}>
          {(["straight_talk", "middle_of_the_road", "take_it_easy"] as const).map(t => (
            <button key={t} style={{ ...S.toneOpt, ...(tone === t ? S.toneOptOn : {}) }} onClick={() => onSetTone(t)}>{TONE_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div style={S.chatMsgs}>
        {messages.length === 0 && <div style={{ ...S.empty, marginTop: 24 }}>No messages yet. Brain dump anything.</div>}
        {messages.map((m, i) => {
          const mentioned = m.role === "assistant" ? tasksMentionedIn(m.content, tasks) : [];
          const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
          return (
            <div key={i} style={{ ...S.bubble, ...(m.role === "user" ? S.bubbleU : S.bubbleA) }}>
              {m.role === "assistant" && <div style={S.bubbleName}>STEWARD</div>}
              <div style={{ ...S.bubbleText, ...(m.role === "user" ? S.bubbleTextU : {}) }}>{m.content}</div>
              {mentioned.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {mentioned.map(t => (
                    <button key={t.id} style={S.chatPrioChip} onClick={() => onOpenPriority(t)}>View priority ›</button>
                  ))}
                </div>
              )}
              {isLastAssistant && suggestedTone && (
                <button style={{ ...S.chatPrioChip, marginTop: 8 }} onClick={() => onSetTone(suggestedTone)}>Switch to {TONE_LABEL[suggestedTone]} ›</button>
              )}
            </div>
          );
        })}
        {sending && <div style={{ ...S.bubble, ...S.bubbleA }}><div style={S.bubbleName}>STEWARD</div><div style={{ ...S.bubbleText, color: C.parchmentDim }}>…</div></div>}
        <div ref={endRef} />
      </div>
      <StewardChatBar input={input} setInput={setInput} send={send} sending={sending} />
    </div>
  );
}

function StewardChatBar({ input, setInput, send, sending }: { input: string; setInput: (v: string) => void; send: () => void; sending: boolean }) {
  const { listening, toggle } = useSpeech(setInput);
  return (
    <div style={S.chatBar}>
      <input style={S.msgInput} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Brain dump anything..." aria-label="Message Steward" />
      <button style={{ ...S.micBtn, ...(listening ? S.micBtnOn : {}) }} onClick={toggle} title={listening ? "Stop" : "Voice input"} aria-label={listening ? "Stop voice input" : "Voice input"}>
        <Icon name="mic" size={15} color={listening ? C.ink : C.parchmentDim} stroke={1.8} />
      </button>
      <button style={S.msgSend} disabled={sending} onClick={send} aria-label="Send message"><Icon name="send" size={16} color={C.ink} /></button>
    </div>
  );
}

// ── Week ───────────────────────────────────────────────────────────────────
function WeekView({ events, jobs, pursuits, calendarAccounts, onConnectCalendar, onDisconnectCalendar }: { events: Event[]; jobs: Job[]; pursuits: Pursuit[]; calendarAccounts: string[]; onConnectCalendar: () => void; onDisconnectCalendar: (email: string) => void }) {
  const days = weekDays();
  const todayKey = ymd(new Date());
  const pursuitNameById = new Map(pursuits.map(p => [p.id, p.name]));
  const datedWork = jobs
    .map(j => jobCalendarEvent(j, (j.pursuitId !== null && pursuitNameById.get(j.pursuitId)) || ""))
    .filter((event): event is Event => Boolean(event));
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
function JobModal({ pursuits, onClose, onCreated }: { pursuits: Pursuit[]; onClose: () => void; onCreated: () => void }) {
  const Qs = [
    { q: "What's the job?", ph: "e.g. First Baptist — monument sign", key: "name" },
    { q: "When does it need to be done?", ph: "e.g. June 20, end of month", key: "due" },
    { q: "Materials needed?", ph: "e.g. 4×8 aluminum, vinyl", key: "materials" },
    { q: "Rough budget or quote?", ph: "e.g. $2,400 or not sure", key: "budget" },
    { q: "Anything that could slow you down?", ph: "e.g. approval, weather", key: "risk" },
  ];
  const [pickingPursuit, setPickingPursuit] = useState(pursuits.length > 0);
  const [pursuitId, setPursuitId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [val, setVal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const saveStatus = useSaveStatus();
  const q = Qs[step];

  function choosePursuit(id: number | null) {
    setPursuitId(id);
    setPickingPursuit(false);
  }

  async function submit(final: Record<string, string>) {
    await saveStatus.save(async () => {
      const r = await fetch(`${API}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: final.name || "Untitled job", due: final.due || "", stage: "New", pct: 0, pursuitId,
          materials: final.materials || "", budget: final.budget || "", risk: final.risk || "",
        }),
      });
      if (r.ok) { onCreated(); onClose(); return true; }
      return false;
    });
  }
  function advance(answer: string) {
    const next = { ...answers, [q.key]: answer };
    setAnswers(next); setVal("");
    if (step < Qs.length - 1) setStep(s => s + 1);
    else submit(next);
  }

  if (pickingPursuit) {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" onClose={onClose}>
          <div style={M.q}>Which pursuit is this for?</div>
          <div style={E.chipRow}>
            {pursuits.map(p => (
              <button key={p.id} style={E.chip} onClick={() => choosePursuit(p.id)}>{p.name}</button>
            ))}
          </div>
          <button style={M.cancel} onClick={() => choosePursuit(null)}>Skip — not tied to a pursuit</button>
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="New Job" headExtra={<div style={S.prioSub}>{step + 1} / {Qs.length}</div>} onClose={onClose}>
        <div style={M.track}><div style={{ ...M.fill, width: ((step + 1) / Qs.length * 100) + "%" }} /></div>
        <div style={M.q}>{q.q}</div>
        <>
          <input style={M.input} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && val.trim() && advance(val)} placeholder={q.ph} autoFocus />
          <button style={M.next} disabled={saveStatus.status === "saving"} onClick={() => advance(val)}>{step < Qs.length - 1 ? "Next →" : saveStatus.status === "saving" ? "Saving…" : "Add Job ✓"}</button>
        </>
        <SaveStatus status={saveStatus.status} onRetry={() => submit(answers)} />
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// ── Job edit modal ────────────────────────────────────────────────────────────
function JobEditModal({ job, pursuits, onClose, onSaved, onDeleted }: { job: Job; pursuits: Pursuit[]; onClose: () => void; onSaved: (pursuitId: number | null) => void; onDeleted: () => void }) {
  const [name, setName] = useState(job.name);
  const [pursuitId, setPursuitId] = useState<number | null>(job.pursuitId);
  const [stage, setStage] = useState(job.stage);
  const [due, setDue] = useState(job.due);
  const [pct, setPct] = useState(job.pct);
  const [materials, setMaterials] = useState(job.materials);
  const [budget, setBudget] = useState(job.budget);
  const [risk, setRisk] = useState(job.risk);
  const saveStatus = useSaveStatus();
  const [validationErr, setValidationErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function save() {
    if (!name.trim()) { setValidationErr("Name is required."); return; }
    setValidationErr("");
    await saveStatus.save(async () => {
      const r = await fetch(`${API}/jobs/${job.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pursuitId, stage: stage.trim(), due: due.trim(), pct, materials: materials.trim(), budget: budget.trim(), risk: risk.trim() }),
      });
      if (r.ok) { onSaved(pursuitId); onClose(); return true; }
      return false;
    });
  }

  async function del() {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/jobs/${job.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted(); onClose(); }
      else { setDelErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setDelErr("Couldn't reach the server."); setDeleting(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Edit Job" onClose={onClose}>
        <div style={E.fieldGroup}>
          <div style={E.label}>Job name</div>
          <input style={M.input} value={name} onChange={e => setName(e.target.value)} placeholder="Job name" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Pursuit</div>
          <select style={S.tribeTagSelect} value={pursuitId ?? ""} onChange={e => setPursuitId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Unsorted</option>
            {pursuits.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
        <div style={E.fieldGroup}>
          <div style={E.label}>Materials needed</div>
          <input style={M.input} value={materials} onChange={e => setMaterials(e.target.value)} placeholder="e.g. 4×8 aluminum, vinyl" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Budget or quote</div>
          <input style={M.input} value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. $2,400 or not sure" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Could slow this down</div>
          <input style={M.input} value={risk} onChange={e => setRisk(e.target.value)} placeholder="e.g. approval, weather" />
        </div>

        <TapError message={validationErr || null} />
        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={saveStatus.status === "saving"} onClick={save}>{saveStatus.status === "saving" ? "Saving…" : "Save Changes"}</button>
        <TapError message={delErr || null} />
        <button style={{ ...M.cancel, color: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Delete Job"}</button>
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// ── Pursuit add/edit modal ──────────────────────────────────────────────────────
function PursuitModal({ pursuit, onClose, onSaved, onDeleted, onClosed }: {
  pursuit?: Pursuit; onClose: () => void; onSaved: () => void; onDeleted?: () => void; onClosed?: () => void;
}) {
  const [name, setName] = useState(pursuit?.name ?? "");
  const [category, setCategory] = useState<PursuitCategory>(pursuit?.category ?? "job");
  const [notes, setNotes] = useState(pursuit?.notes ?? "");
  const saveStatus = useSaveStatus();
  const [validationErr, setValidationErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeErr, setCloseErr] = useState("");

  async function save() {
    if (!name.trim()) { setValidationErr("Name is required."); return; }
    setValidationErr("");
    const body = { name: name.trim(), category, notes: notes.trim() };
    await saveStatus.save(async () => {
      const r = pursuit
        ? await fetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`${API}/pursuits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { onSaved(); onClose(); return true; }
      return false;
    });
  }

  async function del() {
    if (!pursuit) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/pursuits/${pursuit.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted?.(); onClose(); }
      else { setDelErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setDelErr("Couldn't reach the server."); setDeleting(false); }
  }

  // Manual close (#48) — no completion gate, unlike the auto-prompt: this
  // is also how you archive a pursuit you're abandoning, not just one that
  // finished. Soft, reversible from the Closed history view.
  async function close() {
    if (!pursuit) return;
    setClosing(true);
    try {
      const r = await fetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
      if (r.ok) { onClosed?.(); onClose(); }
      else { setCloseErr("Couldn't close. Try again."); setClosing(false); }
    } catch { setCloseErr("Couldn't reach the server."); setClosing(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title={pursuit ? "Edit Pursuit" : "Add Pursuit"} onClose={onClose}>
        <div style={E.fieldGroup}>
          <div style={E.label}>Name</div>
          <input style={M.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Signs, church volunteering" autoFocus />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Category</div>
          <div style={E.chipRow}>
            {PURSUIT_CATEGORIES.map(c => (
              <button key={c} style={{ ...E.chip, ...(category === c ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setCategory(c)}>{PURSUIT_CATEGORY_LABEL[c]}</button>
            ))}
          </div>
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>Notes</div>
          <input style={M.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Role, rhythm, what you track" />
        </div>

        <TapError message={validationErr || null} />
        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={saveStatus.status === "saving"} onClick={save}>{saveStatus.status === "saving" ? "Saving…" : "Save"}</button>
        <TapError message={closeErr || null} />
        {pursuit && <button style={M.cancel} disabled={closing} onClick={close}>{closing ? "Closing…" : "Close Pursuit"}</button>}
        <TapError message={delErr || null} />
        {pursuit && <button style={{ ...M.cancel, color: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Delete Pursuit"}</button>}
        <button style={M.cancel} onClick={onClose}>Cancel</button>
      </ModalSheet>
    </div>
  );
}

// Closed-pursuits history view (#48) — mirrors PeopleDeletedModal/
// CompletedLogModal: a Reopen action, no permanent-delete step needed here
// since "Delete Pursuit" already covers permanent removal separately.
function PursuitsClosedModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [closed, setClosed] = useState<Pursuit[] | null>(null);
  const [reopeningIds, setReopeningIds] = useState<number[]>([]);
  const reopenError = useKeyedTapError<number>();

  const load = useCallback(() => {
    fetch(`${API}/pursuits/deleted`).then(r => r.ok ? r.json() : null).then(d => setClosed(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reopen(id: number) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await fetch(`${API}/pursuits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
      if (r.ok) {
        setClosed(prev => prev ? prev.filter(p => p.id !== id) : prev);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setReopeningIds(prev => prev.filter(item => item !== id));
    reopenError.flash(id, "Couldn't reopen — try again");
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Closed Pursuits" onClose={onClose}>
        <div style={S.scrollCap5}>
          {(closed ?? []).map(p => (
            <div key={p.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.prioTitle}>{p.name}</div>
                  <div style={S.prioSub}>{PURSUIT_CATEGORY_LABEL[p.category]}</div>
                </div>
                <button style={S.prioLogLink} disabled={reopeningIds.includes(p.id)} onClick={() => reopen(p.id)}>
                  {reopeningIds.includes(p.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              <TapError message={reopenError.get(p.id)} />
            </div>
          ))}
          {closed && closed.length === 0 && <div style={S.empty}>Nothing closed yet.</div>}
        </div>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// Auto-close prompt (#48) — surfaced right after saving a job whose pct
// change made it the pursuit's last incomplete job. Closing here uses the
// same PATCH {deleted: true} as the manual action in PursuitModal.
function PursuitCloseFinishedPrompt({ pursuit, onClose, onClosed }: { pursuit: Pursuit; onClose: () => void; onClosed: () => void }) {
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState("");

  async function close() {
    setClosing(true);
    try {
      const r = await fetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
      if (r.ok) { onClosed(); return; }
      setErr("Couldn't close. Try again.");
      setClosing(false);
    } catch { setErr("Couldn't reach the server."); setClosing(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="All Done?" onClose={onClose}>
        <div style={{ ...S.prioSub, marginBottom: 18 }}>Every job under {pursuit.name} is now complete. Close it out and move it to Closed Pursuits?</div>
        <TapError message={err || null} />
        <button style={M.next} disabled={closing} onClick={close}>{closing ? "Closing…" : "Close it out"}</button>
        <button style={M.cancel} onClick={onClose}>Not yet</button>
      </ModalSheet>
    </div>
  );
}

// ── Priority detail modal ─────────────────────────────────────────────────────
function PriorityDetailModal({ task, onClose, onChanged }: { task: Task; onClose: () => void; onChanged: () => void }) {
  const [history, setHistory] = useState<TaskHistory | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(task.recurrencePeriod ?? "weekly");
  const [target, setTarget] = useState(task.recurrenceTarget ?? 1);
  const [status, setStatusState] = useState<"open" | "stuck">(task.partial ? "stuck" : "open");
  const [notesDraft, setNotesDraft] = useState(task.notes);
  const notesBaselineRef = useRef(task.notes);
  const recurrenceSave = useSaveStatus();
  const notesSave = useSaveStatus();
  const { error: actionError, flash: flashActionError } = useTapError();
  const [removing, setRemoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/tasks/${task.id}/history?today=${ymd(new Date())}`)
      .then(r => r.ok ? r.json() : null)
      .then(setHistory);
  }, [task.id]);
  useEffect(() => { load(); }, [load]);

  async function saveRecurrence() {
    await recurrenceSave.save(async () => {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrencePeriod: period, recurrenceTarget: period === "daily" ? 1 : target }),
      });
      if (r.ok) { onChanged(); load(); return true; }
      return false;
    });
  }
  async function removeRecurrence() {
    setRemoving(true);
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrencePeriod: null, recurrenceTarget: null }),
      });
      if (r.ok) { onChanged(); onClose(); return; }
    } catch { /* fall through */ }
    setRemoving(false);
    flashActionError("Couldn't save — try again");
  }
  async function logToday() {
    try {
      const r = await fetch(`${API}/tasks/${task.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: ymd(new Date()) }),
      });
      if (r.ok) { onChanged(); load(); return; }
    } catch { /* fall through */ }
    flashActionError("Couldn't save — try again");
  }
  async function del() {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, { method: "DELETE" });
      if (r.ok) { onChanged(); onClose(); return; }
    } catch { /* fall through */ }
    setDeleting(false);
    flashActionError("Couldn't delete — try again");
  }
  async function setStatusValue(next: "open" | "stuck" | "done") {
    if (next === "done") {
      try {
        const r = await fetch(`${API}/tasks/${task.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: true, partial: false }),
        });
        if (r.ok) { onChanged(); onClose(); return; }
      } catch { /* fall through */ }
      flashActionError("Couldn't save — try again");
      return;
    }
    const prevStatus = status;
    setStatusState(next);
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partial: next === "stuck" }),
      });
      if (r.ok) { onChanged(); return; }
    } catch { /* fall through */ }
    setStatusState(prevStatus);
    flashActionError("Couldn't save — try again");
  }
  async function saveNotes(value: string) {
    if (value === notesBaselineRef.current) return;
    const ok = await notesSave.save(async () => {
      const r = await fetch(`${API}/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      return r.ok;
    });
    if (ok) notesBaselineRef.current = value;
  }

  const periodNoun = task.recurrencePeriod === "daily" ? "day" : task.recurrencePeriod === "monthly" ? "month" : "week";

  const notesSection = (
    <div style={E.fieldGroup}>
      <div style={E.label}>NOTES</div>
      <textarea
        value={notesDraft}
        onChange={e => { setNotesDraft(e.target.value); if (notesSave.status === "error") notesSave.reset(); }}
        onBlur={() => saveNotes(notesDraft)}
        placeholder="Add detail on what's blocking this, or anything worth remembering." style={M.notesArea}
      />
      <SaveStatus status={notesSave.status} onRetry={() => saveNotes(notesDraft)} />
    </div>
  );

  return (
    <div style={M.overlay}>
      <ModalSheet title={task.text} onClose={onClose}>
        {task.recurrencePeriod ? (
          <>
            <div style={{ ...S.prioSub, marginBottom: 10 }}>
              Streak: {history ? history.streak : "…"} {task.recurrencePeriod === "daily" ? "days" : task.recurrencePeriod === "weekly" ? "weeks" : "months"}
            </div>
            {history?.slipping && <div style={{ ...S.prioSubRed, marginBottom: 10 }}>Streak broke — Steward may check in on this.</div>}
            <div style={M.track}><div style={{ ...M.fill, width: `${history?.currentPeriod?.pct ?? 0}%` }} /></div>
            <div style={{ ...S.prioSub, marginBottom: 16 }}>
              {history?.currentPeriod?.completedCount ?? 0} / {history?.currentPeriod?.target ?? task.recurrenceTarget} this {periodNoun}
            </div>
            <button style={M.next} disabled={history?.completedToday} onClick={logToday}>
              {history?.completedToday ? "Completed today ✓" : "Complete for today"}
            </button>
            {notesSection}
            <div style={E.fieldGroup}>
              <div style={E.label}>HISTORY</div>
              {(history?.completions ?? []).length === 0 && <div style={S.prioSub}>Nothing logged yet.</div>}
              {(history?.completions ?? []).slice(0, 30).map(d => <div key={d} style={S.prioSub}>{d}</div>)}
            </div>
            <button style={{ ...M.cancel, color: C.brassSoft }} disabled={removing} onClick={removeRecurrence}>{removing ? "Removing…" : "Remove recurring"}</button>
          </>
        ) : (
          <>
            <div style={E.fieldGroup}>
              <div style={E.label}>STATUS</div>
              {([
                ["open", "Still moving"],
                ["stuck", "Stuck — need a nudge"],
                ["done", "Done"],
              ] as const).map(([s, label]) => (
                <button key={s} style={{ ...M.statusOpt, ...((s === "done" ? false : s === status) ? M.statusOptOn : {}) }} onClick={() => setStatusValue(s)}>
                  {label}
                </button>
              ))}
            </div>
            {notesSection}
            <div style={E.fieldGroup}>
              <div style={E.label}>MAKE THIS RECURRING</div>
              <div style={E.chipRow}>
                {(["daily", "weekly", "monthly"] as const).map(p => (
                  <button key={p} style={{ ...E.chip, ...(period === p ? { background: C.brass, color: C.ink } : {}) }} onClick={() => setPeriod(p)}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              {period !== "daily" && (
                <input type="number" min={1} style={M.input} value={target} onChange={e => setTarget(Math.max(1, Number(e.target.value)))} placeholder="Times per period" />
              )}
            </div>
            <SaveStatus status={recurrenceSave.status} onRetry={saveRecurrence} />
            <button style={M.next} disabled={recurrenceSave.status === "saving"} onClick={saveRecurrence}>{recurrenceSave.status === "saving" ? "Saving…" : "Save"}</button>
            {history && history.completions.length > 0 && (
              <div style={E.fieldGroup}>
                <div style={E.label}>PAST HISTORY (from before recurrence was removed)</div>
                {history.completions.slice(0, 30).map(d => <div key={d} style={S.prioSub}>{d}</div>)}
              </div>
            )}
          </>
        )}
        <TapError message={actionError} />
        <button style={{ ...M.cancel, color: "#C87060" }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Delete priority"}</button>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Completed priorities log modal ────────────────────────────────────────────
function CompletedLogModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ items: Task[]; doneCount: number; totalCount: number; pct: number } | null>(null);
  const [deleted, setDeleted] = useState<Task[] | null>(null);
  const [reopeningIds, setReopeningIds] = useState<number[]>([]);
  const reopenError = useKeyedTapError<number>();

  const load = useCallback(() => {
    fetch(`${API}/tasks/completed`).then(r => r.ok ? r.json() : null).then(setData);
    fetch(`${API}/tasks/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Shared by both lists — "done: false" reopens a completed priority,
  // "deleted: false" restores a deleted one back to the open list.
  async function reopen(id: number, body: { done: boolean } | { deleted: boolean }) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        setData(prev => prev && "done" in body ? { ...prev, items: prev.items.filter(t => t.id !== id), doneCount: prev.doneCount - 1 } : prev);
        setDeleted(prev => prev && "deleted" in body ? prev.filter(t => t.id !== id) : prev);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setReopeningIds(prev => prev.filter(item => item !== id));
    reopenError.flash(id, "Couldn't reopen — try again");
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Completed Priorities" onClose={onClose}>
        <div style={M.track}><div style={{ ...M.fill, width: `${data?.pct ?? 0}%` }} /></div>
        <div style={{ ...S.prioSub, marginBottom: 14 }}>{data?.doneCount ?? 0} of {data?.totalCount ?? 0} priorities completed ({data?.pct ?? 0}%)</div>
        <div style={S.scrollCap5}>
          {(data?.items ?? []).map(t => (
            <div key={t.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#A8C888", fontSize: 14, lineHeight: 1.4 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.prioTitle, textDecoration: "line-through" }}>{t.text}</div>
                  {t.category && <div style={S.prioSub}>{t.category}</div>}
                </div>
                <button style={S.prioLogLink} disabled={reopeningIds.includes(t.id)} onClick={() => reopen(t.id, { done: false })}>
                  {reopeningIds.includes(t.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              <TapError message={reopenError.get(t.id)} />
            </div>
          ))}
          {data && data.items.length === 0 && <div style={S.empty}>Nothing completed yet.</div>}
        </div>

        <div style={{ ...E.label, marginTop: 22, marginBottom: 8 }}>DELETED</div>
        <div style={S.scrollCap5}>
          {(deleted ?? []).map(t => (
            <div key={t.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#C87060", fontSize: 14, lineHeight: 1.4 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.prioTitle, textDecoration: "line-through" }}>{t.text}</div>
                  {t.category && <div style={S.prioSub}>{t.category}</div>}
                </div>
                <button style={S.prioLogLink} disabled={reopeningIds.includes(t.id)} onClick={() => reopen(t.id, { deleted: false })}>
                  {reopeningIds.includes(t.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              <TapError message={reopenError.get(t.id)} />
            </div>
          ))}
          {deleted && deleted.length === 0 && <div style={S.empty}>Nothing deleted.</div>}
        </div>

        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Journal history modal ─────────────────────────────────────────────────────
interface JournalHistoryEntry { date: string; reflect: string; commitText: string; }

function JournalHistoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [entries, setEntries] = useState<JournalHistoryEntry[] | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [intentDraft, setIntentDraft] = useState("");
  const [reflectDraft, setReflectDraft] = useState("");
  const saveStatus = useKeyedSaveStatus<string>();

  const load = useCallback(() => {
    getList<JournalHistoryEntry>(`${API}/journal/history`).then(setEntries);
  }, []);
  useEffect(() => { load(); }, [load]);

  function startEdit(entry: JournalHistoryEntry) {
    setEditingDate(entry.date);
    setIntentDraft(entry.commitText);
    setReflectDraft(entry.reflect);
  }

  async function save(date: string) {
    await saveStatus.save(date, async () => {
      const r = await fetch(`${API}/journal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, commit_text: intentDraft, reflect: reflectDraft }),
      });
      if (r.ok) { setEditingDate(null); load(); onSaved(); }
      return r.ok;
    });
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Journal History" onClose={onClose}>
        <div>
          {(entries ?? []).map(entry => (
            <div key={entry.date} style={S.card}>
              <div style={S.prioSub}>{entry.date}</div>
              {editingDate === entry.date ? (
                <>
                  <div style={{ ...E.fieldGroup, marginTop: 8 }}>
                    <div style={E.label}>Intention</div>
                    <input style={M.input} value={intentDraft} onChange={e => { setIntentDraft(e.target.value); if (saveStatus.get(entry.date) === "error") saveStatus.reset(entry.date); }} placeholder="—" />
                  </div>
                  <div style={E.fieldGroup}>
                    <div style={E.label}>Reflection</div>
                    <textarea style={{ ...M.input, resize: "none" }} rows={3} value={reflectDraft} onChange={e => { setReflectDraft(e.target.value); if (saveStatus.get(entry.date) === "error") saveStatus.reset(entry.date); }} placeholder="—" />
                  </div>
                  <SaveStatus status={saveStatus.get(entry.date)} onRetry={() => save(entry.date)} />
                  <button style={M.next} disabled={saveStatus.get(entry.date) === "saving"} onClick={() => save(entry.date)}>{saveStatus.get(entry.date) === "saving" ? "Saving…" : "Save"}</button>
                  <button style={M.cancel} onClick={() => setEditingDate(null)}>Cancel</button>
                </>
              ) : (
                <button style={{ background: "none", border: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: F, marginTop: 6 }} onClick={() => startEdit(entry)}>
                  <div style={S.prioTitle}>{entry.commitText || "—"}</div>
                  <div style={S.prioSub}>{entry.reflect || "—"}</div>
                </button>
              )}
            </div>
          ))}
          {entries && entries.length === 0 && <div style={S.empty}>No journal entries yet.</div>}
        </div>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Auth gate ───────────────────────────────────────────────────────────────────
type EmailLoginStartResult = { ok: true } | { ok: false; error: string };
type EmailLoginVerifyResult = { ok: true; pendingApproval: boolean } | { ok: false; error: string };

function AuthGate({
  loading,
  pendingApproval,
  onLogin,
  onStartEmailLogin,
  onVerifyEmailLogin,
}: {
  loading: boolean;
  pendingApproval: boolean;
  onLogin: (provider?: "google" | "microsoft" | "demo") => void;
  onStartEmailLogin: (email: string) => Promise<EmailLoginStartResult>;
  onVerifyEmailLogin: (email: string, code: string, name?: string) => Promise<EmailLoginVerifyResult>;
}) {
  const [step, setStep] = useState<"providers" | "email" | "code">("providers");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem("steward:email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!email.trim()) { setError("Enter your email first."); return; }
    setBusy(true);
    setError("");
    const result = await onStartEmailLogin(email.trim());
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    localStorage.setItem("steward:email", email.trim());
    setCode("");
    setStep("code");
  }

  async function verifyCode(codeOverride?: string) {
    const codeToVerify = codeOverride ?? code;
    if (!/^[0-9]{6}$/.test(codeToVerify)) { setError("Enter the 6-digit code."); return; }
    setBusy(true);
    setError("");
    const result = await onVerifyEmailLogin(email.trim(), codeToVerify, name.trim());
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    // On success the auth hook updates `user`/`pendingApproval` and this
    // component's parent re-renders past the gate (or into the pending state).
  }

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
        ) : step === "providers" ? (
          <>
            <div style={G.welcome}>Welcome back.</div>
            <button style={G.googleBtn} onClick={() => onLogin("google")}>Continue with Google</button>
            <button style={{ ...G.googleBtn, marginTop: 10 }} onClick={() => onLogin("microsoft")}>Continue with Microsoft</button>
            <button style={{ ...G.googleBtn, marginTop: 10 }} onClick={() => { setError(""); setStep("email"); }}>Continue with Email</button>
            <div style={G.notice}>New here? Sign in above to request access.</div>
          </>
        ) : step === "email" ? (
          <>
            <div style={G.welcome}>Sign in with email</div>
            <input
              style={M.input}
              type="text"
              autoComplete="name"
              autoFocus={!email}
              placeholder="Your name (optional)"
              aria-label="Your name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendCode()}
            />
            <input
              style={M.input}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus={!!email}
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendCode()}
            />
            {error && <div role="alert" style={{ ...S.empty, color: "#D4A090", marginBottom: 8 }}>{error}</div>}
            <button style={G.googleBtn} disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send code"}</button>
            <button style={{ ...G.addHomeToggle, marginTop: 14 }} onClick={() => { setError(""); setStep("providers"); }}>Back</button>
          </>
        ) : (
          <>
            <div style={G.welcome}>Enter your code</div>
            <div style={{ ...G.notice, marginTop: -8, marginBottom: 14 }}>We sent a 6-digit code to {email}</div>
            <input
              style={{ ...M.input, textAlign: "center", letterSpacing: "0.3em", fontSize: 22 }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              aria-label="6-digit verification code"
              value={code}
              onChange={e => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                if (next.length === 6) verifyCode(next);
              }}
              onKeyDown={e => e.key === "Enter" && verifyCode()}
            />
            {error && <div role="alert" style={{ ...S.empty, color: "#D4A090", marginBottom: 8 }}>{error}</div>}
            <button style={G.googleBtn} disabled={busy} onClick={() => verifyCode()}>{busy ? "Verifying…" : "Verify"}</button>
            <button style={{ ...G.addHomeToggle, marginTop: 14 }} disabled={busy} onClick={sendCode}>Resend code</button>
            <button style={{ ...G.addHomeToggle, marginTop: 10 }} onClick={() => { setError(""); setCode(""); setStep("email"); }}>Use a different email</button>
          </>
        )}
        <AddToHomeScreen />
      </div>
    </div>
  );
}

const ADD_HOME_STEPS: Record<"ios" | "android", string[]> = {
  ios: [
    "Open this page in Safari.",
    "Tap the Share icon (square with an arrow) in the toolbar.",
    'Scroll down and tap "Add to Home Screen".',
    'Tap "Add" in the top right.',
  ],
  android: [
    "Open this page in Chrome.",
    "Tap the ⋮ menu icon in the toolbar.",
    'Tap "Add to Home screen" (or "Install app").',
    'Tap "Add" / "Install" to confirm.',
  ],
};

function AddToHomeScreen() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">(
    () => (/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "android"),
  );
  return (
    <div style={G.addHome}>
      <button style={G.addHomeToggle} onClick={() => setOpen(o => !o)}>
        {open ? "Hide" : "📲 Add Steward to your Home Screen"}
      </button>
      {open && (
        <div style={G.addHomePanel}>
          <div style={G.addHomeTabs}>
            <button
              style={{ ...G.addHomeTab, ...(platform === "ios" ? G.addHomeTabOn : {}) }}
              onClick={() => setPlatform("ios")}
            >
              iPhone
            </button>
            <button
              style={{ ...G.addHomeTab, ...(platform === "android" ? G.addHomeTabOn : {}) }}
              onClick={() => setPlatform("android")}
            >
              Android
            </button>
          </div>
          {ADD_HOME_STEPS[platform].map((step, i) => (
            <div key={i} style={G.addHomeStep}>
              <span style={G.addHomeStepNum}>{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const G: Record<string, CSSProperties> = {
  wrap: { position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" },
  loading: { color: C.parchmentLow, fontSize: 14, letterSpacing: "0.04em" },
  welcome: { fontSize: 26, fontWeight: 400, color: C.parchment, textShadow: "0 2px 8px rgba(0,0,0,0.5)", marginBottom: 22, textAlign: "center" },
  googleBtn: { width: "100%", background: "rgba(30,26,16,0.62)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchmentMid, fontSize: 14, fontWeight: 700, padding: "13px 16px", cursor: "pointer", fontFamily: F },
  notice: { fontSize: 12, color: C.parchmentLow, marginTop: 14, textAlign: "center" },
  addHome: { marginTop: 18, width: "100%", textAlign: "center" },
  addHomeToggle: { background: "none", border: "none", color: C.brassSoft, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F, textDecoration: "underline", textUnderlineOffset: 3 },
  addHomePanel: { marginTop: 12, background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, padding: "14px 16px", textAlign: "left" },
  addHomeTabs: { display: "flex", gap: 8, marginBottom: 12 },
  addHomeTab: { flex: 1, background: "rgba(20,18,11,0.6)", border: "1px solid rgba(210,190,130,0.14)", borderRadius: 8, color: C.parchmentDim, fontSize: 12, fontWeight: 600, padding: "7px 10px", cursor: "pointer", fontFamily: F, textAlign: "center" },
  addHomeTabOn: { borderColor: C.brass, color: C.brass, boxShadow: `0 0 10px ${C.brassGlow}` },
  addHomeStep: { fontSize: 12.5, color: C.parchmentMid, lineHeight: 1.5, marginBottom: 6, display: "flex", gap: 8 },
  addHomeStepNum: { color: C.brassSoft, fontWeight: 700, flexShrink: 0 },
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
  stewardIcon: { width: 20, height: 20, borderRadius: "50%", border: `1.6px solid ${C.parchmentLow}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.parchmentLow, fontFamily: F },
  stewardIconOn: { borderColor: C.brass, color: C.brass, boxShadow: `0 0 10px ${C.brassGlow}` },
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
  prioHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  prioLogLink: { background: "none", border: "none", color: C.brassSoft, fontSize: 12, cursor: "pointer", fontFamily: F },
  prioExpandBtn: { width: "100%", background: "none", border: "1px dashed rgba(210,190,130,0.22)", borderRadius: 12, color: C.brassSoft, fontSize: 12.5, fontWeight: 600, padding: "10px", cursor: "pointer", fontFamily: F, marginTop: 4 },
  eyeText: { fontSize: 11, letterSpacing: "0.16em", color: C.brassSoft, fontWeight: 600 },
  verseText: { fontSize: 18, lineHeight: 1.6, color: C.parchment, marginBottom: 14, textAlign: "center" },
  verseRef: { fontSize: 11, letterSpacing: "0.12em", color: C.brassSoft },
  intent: { fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  intentInput: { width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontFamily: F, fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  empty: { fontSize: 13, color: C.parchmentDim, textAlign: "center", padding: "6px 0" },
  pulseSub: { fontSize: 12, color: C.parchmentDim, marginTop: -6, marginBottom: 14 },
  pulseRow: { marginBottom: 10 },
  pulseRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  pulseLabel: { fontSize: 14, color: C.parchment },
  pulseBtns: { display: "flex", gap: 8 },
  pulseBtn: { width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(210,190,130,0.22)", background: "rgba(30,26,16,0.5)", color: C.parchmentDim, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  pulseNoteInput: { width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(210,190,130,0.16)", outline: "none", fontFamily: F, fontSize: 12, color: C.parchmentMid, padding: "4px 0", marginTop: 6 },
  prioLine: { position: "absolute", left: 19, top: 18, bottom: 20, width: 2, background: `linear-gradient(180deg,${C.walnutLite},${C.walnut})`, boxShadow: "0 0 4px rgba(0,0,0,0.5)" },
  prioRow: { display: "flex", gap: 14, alignItems: "flex-start", position: "relative" },
  prioNum: { width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: `radial-gradient(circle at 35% 28%,${C.walnutMid},${C.walnut} 70%,#3E2814)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.parchment, boxShadow: `0 3px 10px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,220,160,0.25),inset 0 -2px 4px rgba(0,0,0,0.4),0 0 0 5px rgba(20,18,11,0.85)`, zIndex: 1, textShadow: "0 1px 2px rgba(0,0,0,0.5)", border: "none", cursor: "pointer" },
  prioNumDone: { background: `radial-gradient(circle at 35% 28%,#7A9860,#4E6838 70%,#26361A)`, opacity: 0.85 },
  prioRowYellow: { boxShadow: `inset 3px 0 0 0 ${C.brass}` },
  prioRowRed: { boxShadow: "inset 3px 0 0 0 #C87060" },
  prioRowGreen: { boxShadow: "inset 3px 0 0 0 #8FAE6E" },
  prioSubRed: { fontSize: 12, color: "#C87060", lineHeight: 1.4 },
  prioSubGreen: { fontSize: 12, color: "#8FAE6E", lineHeight: 1.4 },
  prioEditBtn: { flexShrink: 0, alignSelf: "center", background: "none", border: "none", color: C.brassSoft, fontSize: 12.5, fontWeight: 600, padding: "6px 4px", cursor: "pointer", fontFamily: F },
  prioTitle: { fontSize: 15, color: C.parchment, lineHeight: 1.4, marginBottom: 3 },
  prioSub: { fontSize: 12, color: C.parchmentDim, lineHeight: 1.4 },
  // Caps a list to roughly 5 rows tall, scrolling for the rest (Completed / Deleted logs).
  scrollCap5: { maxHeight: 300, overflowY: "auto" as const, paddingRight: 4 },
  swipeWrap: { position: "relative", overflow: "hidden", borderRadius: 12, touchAction: "pan-y" },
  swipeFront: { background: "transparent", width: "100%" },
  deleteCue: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 22, border: "none", background: "#C87060", color: "#fff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontFamily: F },
  completeCue: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 22, border: "none", background: "#8FAE6E", color: "#fff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontFamily: F },
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
  writeBtn: { flexShrink: 0, alignSelf: "flex-start", background: "transparent", border: `1.5px solid ${C.brass}`, borderRadius: 24, color: C.brass, fontSize: 13, fontWeight: 600, padding: "10px 18px", cursor: "pointer", boxShadow: `0 0 16px ${C.brassGlow},inset 0 0 8px rgba(216,170,62,0.1)` },
  msgBar: { display: "flex", alignItems: "center", gap: 11, background: "rgba(8,10,5,0.55)", backdropFilter: "blur(8px)", borderRadius: 30, padding: "11px 11px 11px 17px", marginBottom: 14, border: "1px solid rgba(210,190,130,0.16)", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.3)" },
  msgInput: { flex: 1, background: "none", border: "none", color: C.parchment, fontSize: 14, outline: "none", fontFamily: F },
  msgSend: { width: 36, height: 36, borderRadius: "50%", background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 12px ${C.brassGlow},inset 0 1px 0 rgba(255,240,200,0.3)` },
  micBtn: { width: 32, height: 32, borderRadius: "50%", background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.16)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" },
  micBtnOn: { background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: `1px solid ${C.brass}`, boxShadow: `0 0 14px ${C.brassGlow}`, animation: "micPulse 1s ease-in-out infinite" },
  bottomTag: { textAlign: "center", fontSize: 10, letterSpacing: "0.18em", color: C.brassSoft, opacity: 0.7, marginBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: 400, color: C.parchment, marginBottom: 4, textShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  pageSub: { fontSize: 13, color: C.parchmentDim, marginBottom: 18 },
  toneRow: { display: "flex", gap: 6, marginBottom: 14, marginTop: -4 },
  toneOpt: { flex: 1, background: "rgba(24,20,12,0.55)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 14, color: C.parchmentDim, fontSize: 11.5, fontWeight: 600, padding: "7px 4px", cursor: "pointer", fontFamily: F },
  toneOptOn: { borderColor: C.brass, background: "rgba(216,170,62,0.16)", color: C.parchment },
  logRow: { display: "flex", gap: 8, marginBottom: 14 },
  logInput: { flex: 1, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: "12px 14px", outline: "none", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  logBtn: { background: `linear-gradient(135deg,${C.walnutMid},${C.walnut})`, border: "none", borderRadius: 12, color: C.parchment, fontSize: 13, fontWeight: 700, padding: "12px 18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,220,160,0.15)" },
  commitRow: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  commitCard: { display: "flex", flexDirection: "column", width: "100%", background: "transparent" },
  commitExpandBtn: { flexShrink: 0, alignSelf: "center", background: "none", border: "none", color: C.parchmentDim, fontSize: 14, padding: "6px 4px", cursor: "pointer", fontFamily: F },
  commitExpandPanel: { marginLeft: 34, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(210,190,130,0.12)", display: "flex", flexDirection: "column", gap: 6 },
  tribeRow: { display: "flex", gap: 12, alignItems: "center", marginBottom: 10 },
  tribeNameBtn: { flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: F, padding: 0 },
  dragHandle: { flexShrink: 0, width: 22, background: "none", border: "none", color: C.parchmentLow, fontSize: 16, cursor: "grab", padding: "6px 0", touchAction: "none", fontFamily: F },
  peopleDivider: { height: 1, background: "rgba(210,190,130,0.14)", margin: "4px 0 10px" },
  tribeTagSelect: { width: "100%", background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchmentMid, fontSize: 13, fontFamily: F, padding: "10px 12px", outline: "none", marginBottom: 14 },
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
  chatPrioChip: { alignSelf: "flex-start", background: "rgba(216,170,62,0.14)", border: "1px solid rgba(216,170,62,0.4)", borderRadius: 16, color: C.brassSoft, fontSize: 12, fontWeight: 600, padding: "6px 12px", cursor: "pointer", fontFamily: F },
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
  // The page behind (R.root's `background: C.ink`, #0C0E07) is already
  // near-black by design — a flat black tint on top of that reads as a
  // solid gray/black slab no matter how low its alpha goes, since there's
  // almost no brightness back there for a black wash to preserve. A warm,
  // low-alpha walnut tint (matching the app's own palette) instead of flat
  // black is what actually reads as "dimmed," not "blacked out."
  overlay: { position: "fixed", inset: 0, background: "rgba(90,58,32,0.28)", display: "flex", alignItems: "flex-end", zIndex: 200, backdropFilter: "blur(3px)" },
  // maxHeight + overflowY (not a blanket `overflow: hidden`) so content
  // taller than the viewport scrolls instead of clipping inaccessibly —
  // every modal in the app shares this one sheet style (#66).
  sheet: { width: "100%", maxWidth: 440, margin: "0 auto", maxHeight: "88vh", position: "relative", overflowY: "auto", overflowX: "hidden", background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))", backdropFilter: "blur(24px)", borderRadius: "22px 22px 0 0", padding: "24px 24px 48px", border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none", boxShadow: "0 -10px 50px rgba(0,0,0,0.7)" },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.brass},transparent)`, boxShadow: `0 0 14px ${C.brassGlow}` },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 23, color: C.parchment, fontWeight: 400 },
  track: { height: 3, background: "rgba(0,0,0,0.45)", borderRadius: 2, overflow: "hidden", marginBottom: 24 },
  fill: { height: "100%", background: `linear-gradient(90deg,${C.brassDeep},${C.brass})`, borderRadius: 2, transition: "width 0.3s", boxShadow: `0 0 7px ${C.brassGlow}` },
  q: { fontSize: 20, color: C.parchment, lineHeight: 1.4, marginBottom: 22 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  choice: { background: "rgba(34,30,18,0.9)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 14, padding: "16px", cursor: "pointer", fontFamily: F, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" },
  input: { width: "100%", background: "rgba(8,10,5,0.7)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 15, fontFamily: F, padding: "14px", outline: "none", marginBottom: 12, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  statusOpt: { width: "100%", textAlign: "left", background: "rgba(8,10,5,0.4)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchmentDim, fontSize: 14, fontFamily: F, padding: "13px 16px", marginBottom: 8, cursor: "pointer" },
  statusOptOn: { borderColor: C.brass, background: "rgba(216,170,62,0.14)", color: C.parchment },
  notesArea: { width: "100%", minHeight: 80, background: "rgba(8,10,5,0.7)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: 14, outline: "none", marginBottom: 4, resize: "vertical" },
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
