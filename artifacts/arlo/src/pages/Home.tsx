import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useId, useContext, createContext } from "react";
import type { CSSProperties, ReactElement, ReactNode, PointerEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/apiFetch";
import { useSpeech } from "../hooks/use-speech";
import { AppTour } from "../components/AppTour";

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
  // 1+ Tribe people, or an ad-hoc one-time target — never both (#72).
  relationshipIds: number[]; adHocName: string | null; adHocCategory: RelationshipCategory | null;
}
interface Job { id: number; biz: string; name: string; stage: string; due: string; pct: number; pursuitId: number | null; materials: string; budget: string; risk: string; notes: string; }
type PursuitCategory = "job" | "business" | "volunteer" | "hobby" | "side_hustle" | "other";
interface Pursuit { id: number; name: string; category: PursuitCategory; notes: string; }
const PURSUIT_CATEGORIES: PursuitCategory[] = ["job", "business", "volunteer", "hobby", "side_hustle", "other"];
const PURSUIT_CATEGORY_LABEL: Record<PursuitCategory, string> = { job: "Job", business: "Business", volunteer: "Volunteer", hobby: "Hobby", side_hustle: "Side Hustle", other: "Other" };
// #91 follow-up (job/pursuit redesign) — categories a job-creation fork's
// inline "+ New pursuit" step is allowed to offer, keyed by fork. "My job"
// isn't listed: it never shows a category picker at all (always "job").
const OWNABLE_PURSUIT_CATEGORIES: PursuitCategory[] = ["business", "side_hustle"];
const OTHER_PURSUIT_CATEGORIES: PursuitCategory[] = ["volunteer", "hobby", "other"];
interface Event { id: number; date: string; time: string; title: string; sub: string; tag: string; kind: string; }
interface Message { role: "user" | "assistant"; content: string; }
// commitTextDate (#94) is the date the Marriage Intention (commit_text) was
// last actually saved — null until ever saved. Marriage Intention persists
// until changed now, so this drives the "hasn't been updated in a while"
// note; reflect stays exactly as it always was, today-only.
interface Journal { reflect: string; commit_text: string; commitTextDate: string | null; }
type RelationshipCategory = "spouse" | "child" | "family" | "friend" | "other";
interface Relationship {
  id: number; name: string | null; category: RelationshipCategory; type: string;
  notes: string; commitments: string; biggestChallenge: string; starred: boolean; sortOrder: number | null;
}
const RELATIONSHIP_CATEGORIES: RelationshipCategory[] = ["spouse", "child", "family", "friend", "other"];
const RELATIONSHIP_CATEGORY_LABEL: Record<RelationshipCategory, string> = { spouse: "Spouse", child: "Child", family: "Family", friend: "Friend", other: "Other" };
type ToneVoice = "straight_talk" | "middle_of_the_road" | "take_it_easy";
// #92 — the onboarding-derived fields, editable via "Edit My Answers" or
// re-filled by "Redo the Interview" (both in ProfileMenu). Relationships
// and pursuits are deliberately not part of this shape — they live in
// their own tables (Tribe/Work), never in profile.data.
interface CoreIdentity { worldview?: string | null; top_priority?: string | null; values?: string[] | null; }
interface PlanningProfile { decision_drain?: string | null; common_failure_point?: string | null; ideal_rhythm?: string | null; where_ai_helps_most?: string | null; }
interface Guardrails { do_not_suggest?: string[] | null; always_remind_of?: string | null; }
interface ProfileData {
  name?: string | null; season_of_life?: string | null;
  core_identity?: CoreIdentity | null; planning_profile?: PlanningProfile | null; guardrails?: Guardrails | null;
  voice?: ToneVoice | null; remindersEnabled?: boolean | null; hintsEnabled?: boolean | null; dismissedHints?: string[] | null;
}
interface VerseEntry { ref: string; text: string; favorited: boolean; custom?: boolean; id?: number; }
interface VerseHistoryEntry extends VerseEntry { date: string; }
interface MyVerse { id: number; ref: string; text: string; favorited: boolean; }
// #93 — "account" for the pinned, always-verified login email, or a
// reminder_emails row id (as a string) for anything the user's added.
interface ReminderEmailEntry { id: string; email: string; verified: boolean; active: boolean; removable: boolean; pending: boolean; }
type PulseCategory = "physical" | "mental" | "spiritual";
type PulseState = "up" | "mid" | "down";
interface PulseCheckEntry { category: PulseCategory; state: PulseState; note: string; }
const PULSE_CATEGORIES: { id: PulseCategory; label: string }[] = [
  { id: "physical", label: "Physical" },
  { id: "mental", label: "Mental" },
  { id: "spiritual", label: "Spiritual" },
];

// #82 — "The Sphere": a weekly (not daily) self-examination, otherwise the
// same up/mid/down + note shape as Pulse Check (PulseState is reused as-is,
// same 3-value vocabulary and color mapping).
type SphereCategory = "family" | "yourself" | "community" | "provide" | "lead";
type SphereAnswerState = "up" | "mid" | "down" | null;
// One entry per question in that category's fixed SPHERE_QUESTIONS list
// (matched by array index) — the itemized result of "Walk through this",
// as opposed to just tapping a battery icon manually. Both are valid,
// independent ways to arrive at the same state+note (see #82's spec).
interface SphereAnswer { questionIndex: number; answer: SphereAnswerState; note: string; followup: string; subAnswer: "yes" | "no" | null; }
interface SphereCheckEntry { category: SphereCategory; state: PulseState; note: string; answers: SphereAnswer[] | null; }
// #142/SIM-08: `hint` is a short, always-visible one-line definition
// rendered under a category's own h2 label (see the Sphere category-card
// loop below) — only set for the two labels the simulation report flagged
// as unclear on their own (Provision, Leadership); Family/Yourself/
// Community read fine unexplained.
const SPHERE_CATEGORIES: { id: SphereCategory; label: string; group: string | null; hint?: string }[] = [
  { id: "family", label: "Family", group: "Protect" },
  { id: "yourself", label: "Yourself", group: "Protect" },
  { id: "community", label: "Community", group: "Protect" },
  { id: "provide", label: "Provision", group: "Provision", hint: "Earning and stewarding what your household needs." },
  { id: "lead", label: "Leadership", group: "Leadership", hint: "Guiding others — at work, at home, or in your community." },
];
interface SphereWeek { weekStart: string; state: PulseState | "none"; note: string; }
interface SphereDashboardCategory { category: SphereCategory; weeks: SphereWeek[]; }
interface SphereMonthWeek { weekStart: string; state: PulseState; note: string; }
interface SphereMonthCategory { category: SphereCategory; state: PulseState | null; weeks: SphereMonthWeek[]; }
interface SphereMonth { month: string; score: number; categories: SphereMonthCategory[]; }

// ── Sphere walkthrough content ──────────────────────────────────────────────
// Every question + every answer branch's follow-up, per the grilled/reviewed
// spec on #82. "yn" = Not really/Some/Yes; "agree" (Leadership's closing
// question) = Disagree/Not Sure/Agree; "struggle" (Yourself only) has its
// own nested branching — see its own comment below.
interface SphereQuestionYn { type: "yn"; text: string; negFollowup: string; posFollowup?: string; midFollowup?: string; }
interface SphereQuestionAgree { type: "agree"; text: string; negFollowup: string; midFollowup: string; }
interface SphereQuestionStruggle {
  type: "struggle"; text: string; subQuestion: string;
  workingYesLabel: string; workingNoLabel: string; someFollowup: string; notReallyResponse: string;
}
type SphereQuestion = SphereQuestionYn | SphereQuestionAgree | SphereQuestionStruggle;
const SPHERE_MOMENTUM_Q = "Nice job! What's the plan to keep maintaining your momentum?";
const SPHERE_HOLDING_BACK_Q = "What's holding you back?";
function ynQuestion(text: string, negFollowup: string): SphereQuestionYn { return { type: "yn", text, negFollowup }; }

const SPHERE_QUESTIONS: Record<SphereCategory, SphereQuestion[]> = {
  family: [
    ynQuestion("Is your family physically healthy and taken care of right now?", "What's getting in the way?"),
    ynQuestion("Is your family doing okay emotionally?", "What's going on?"),
    ynQuestion("Do you feel your family is safe — physically, financially, otherwise?", "What's the biggest risk right now?"),
  ],
  yourself: [
    ynQuestion("Are you eating well, exercising, and getting enough sleep?", "What's the biggest obstacle right now?"),
    ynQuestion("Are you spending time in the Bible?", "What's getting in the way?"),
    ynQuestion("Are you watching what you consume on your phone, TV, music, podcasts, social media, etc.?", "What's something you should cut back on?"),
    ynQuestion("Are you taking breaks, and avoiding excess stress or toxic people?", "What's the biggest source of stress right now?"),
    ynQuestion("Do you have appropriate boundaries in your life with other people?", "Where do you need a boundary you don't have yet?"),
    ynQuestion("Are you prioritizing God first, marriage 2nd, yourself and your children 3rd, and everything else 4th?", "What's out of order right now?"),
    // "Yes" here is the negative signal (struggling) — its answer-set state
    // colors are inverted (down=Yes, up=Not really) in SPHERE_ANSWER_SETS
    // so the rollup math (up=good/down=bad) stays correct without
    // special-casing it there.
    {
      type: "struggle",
      text: "Are you struggling with any addictions, resentments, anger, or struggles in your life?",
      subQuestion: "Are you working to resolve this issue?",
      workingYesLabel: "How are you working on improving the situation?",
      workingNoLabel: "What's holding you back?",
      someFollowup: "Are you being honest with yourself? Is this a small issue, or are you avoiding addressing it?",
      notReallyResponse: "That's great — just make sure you're being honest with yourself.",
    },
  ],
  community: [
    ynQuestion("Are you mentoring anyone?", "Who's someone you could start investing in?"),
    ynQuestion("Is someone mentoring you?", "Who's someone you could ask?"),
    ynQuestion("Are you serving others?", "What's one way you could start serving?"),
    {
      type: "yn",
      text: "Are you making time for close male friends or a band of brothers?",
      posFollowup: "Nice job — men need close male friendships to thrive. Keep it up.",
      midFollowup: "What's holding you back? Remember — iron sharpens iron.",
      negFollowup: "Who is someone you can reach out to? Men weren't designed to carry the burdens of this world alone.",
    },
  ],
  provide: [
    ynQuestion("Are you tithing?", "What's stopping you?"),
    ynQuestion("Are you helping those less fortunate than you?", "What's one way you could start?"),
    ynQuestion("Are you managing your money well?", "Where's it breaking down?"),
    ynQuestion("Are you out of, or working to eliminate, debt?", "What's the plan to move forward?"),
    ynQuestion("Are you working as if working for the Lord?", "What's getting in the way of that?"),
    ynQuestion("Are you working to improve both your situation and those within your sphere of influence?", "What's one thing you could do this week?"),
  ],
  lead: [
    ynQuestion("Are you leading at home?", "Why not?"),
    ynQuestion("Are you leading at work?", "Why not?"),
    ynQuestion("Are you leading at church or in your community?", "How can you get involved?"),
    { type: "agree", text: "Leading means owning your piece and doing your best with it — whether or not you're in charge.", negFollowup: "What would you push back on?", midFollowup: "What's unclear about that?" },
  ],
};
const SPHERE_ANSWER_SETS: Record<SphereQuestion["type"], [PulseState, string][]> = {
  yn: [["up", "Yes"], ["mid", "Some"], ["down", "Not really"]],
  agree: [["up", "Agree"], ["mid", "Not Sure"], ["down", "Disagree"]],
  struggle: [["down", "Yes"], ["mid", "Some"], ["up", "Not really"]],
};
function sphereFollowupFor(q: SphereQuestionYn | SphereQuestionAgree, answer: PulseState): string {
  if (answer === "up") return ("posFollowup" in q && q.posFollowup) || SPHERE_MOMENTUM_Q;
  if (answer === "mid") return ("midFollowup" in q && q.midFollowup) || SPHERE_HOLDING_BACK_Q;
  return q.negFollowup;
}
function sphereBlankAnswers(questions: SphereQuestion[]): SphereAnswer[] {
  return questions.map((_q, questionIndex) => ({ questionIndex, answer: null, note: "", followup: "", subAnswer: null }));
}

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

// Today's Coming Up card is a fixed small column (#98) — keep whatever the
// source's raw title is (a Google Calendar summary, a manual entry, a
// commitment's text) short enough to fit and still read as a real title.
function briefTitle(title: string, max = 30): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

async function getJson(url: string, fallback: unknown) {
  try {
    const response = await apiFetch(url, { credentials: "include" });
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

const saveStatusText: CSSProperties = { fontSize: 14, color: "#9C9272", marginTop: 5, fontFamily: F };
const saveStatusRetry: CSSProperties = { background: "none", border: "none", padding: 0, color: "#C89A34", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, textDecoration: "underline" };

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
  return <div role="alert" style={{ fontSize: 14, color: "#C87060", marginTop: 4, fontFamily: F }}>{message}</div>;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
type IconName = "book" | "heart" | "target" | "cal" | "clock" | "pen" | "chat" | "sun" | "work" | "user" | "send" | "mic" | "globe" | "sync";
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
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><line x1="3.3" y1="8.5" x2="20.7" y2="8.5" /><line x1="3.3" y1="15.5" x2="20.7" y2="15.5" /></>,
    sync: <><path d="M21 12a9 9 0 0 1-15.5 6.36" /><path d="M3 12a9 9 0 0 1 15.5-6.36" /><path d="M21 3v6h-6" /><path d="M3 21v-6h6" /></>,
  };
  // Every icon in the app is decorative — paired with a visible label, or
  // sitting inside a button that carries its own aria-label — so it's
  // hidden from assistive tech rather than announced as an unlabeled image (#36).
  return <svg {...p} aria-hidden="true">{m[name]}</svg>;
}

// #39: label is "Chat", not "Steward" — the app itself is already called
// Steward (header logo, sign-in screen), so a nav tab with the same name
// didn't clearly read as "this opens the AI chat." The tab id stays
// "steward" internally, matching the existing "her"/"Tribe" precedent (#28).
const NAV: { id: TabId; icon: IconName | "stewardIcon"; label: string }[] = [
  { id: "today", icon: "sun", label: "Today" },
  { id: "her", icon: "heart", label: "Tribe" },
  { id: "work", icon: "work", label: "Work" },
  { id: "sphere", icon: "globe", label: "Sphere" },
  { id: "steward", icon: "stewardIcon", label: "Chat" },
  { id: "week", icon: "cal", label: "Week" },
];
type TabId = "today" | "her" | "work" | "sphere" | "steward" | "week";

const BIZ_PALETTE = ["#8AB46A", "#6AAEC8", "#C89840", "#B080C0", "#C87060", "#60A8B4", "#A890C0"];
function pursuitColor(pursuitId: number | null, ids: number[]) {
  const i = pursuitId === null ? -1 : ids.indexOf(pursuitId);
  return BIZ_PALETTE[i >= 0 ? i % BIZ_PALETTE.length : 0];
}

// #86 — locks the actual document body while 1+ modals are open. Module-level
// and reference-counted (not per-modal state) because modals can stack, and
// only the *first* lock/*last* unlock should touch the real DOM: an inner
// modal unmounting while an outer one is still open must not restore scroll
// out from under it. `position: fixed` (not just `overflow: hidden`) is what
// actually matters here — M.sheet already had `overscroll-behavior: contain`
// (#86's first attempt) to stop a scroll gesture at the sheet's own edges
// from chaining into the page behind it, but that alone doesn't stop iOS
// Safari's elastic rubber-band bounce, which is a property of the body's own
// touch handling, not of scroll chaining — the previous fix stopped the
// gesture from scrolling the page, but not from visually bouncing it. Pinning
// the body via `position: fixed` removes it from that physics entirely.
let modalLockCount = 0;
let modalLockScrollY = 0;
function lockBodyScroll() {
  if (modalLockCount === 0) {
    modalLockScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${modalLockScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
  }
  modalLockCount++;
}
function unlockBodyScroll() {
  modalLockCount--;
  if (modalLockCount === 0) {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    window.scrollTo(0, modalLockScrollY);
  }
}

// ── Modal dialog shell (#36) ──────────────────────────────────────────────────
// Every modal in the app renders the same overlay/sheet/strip/head/title
// boilerplate by hand — this centralizes the part that needs real a11y
// behavior (dialog semantics, a labelled heading, Escape-to-close, focus
// moved in on open and restored to whatever triggered it on close) so
// every modal gets it uniformly instead of retrofitting each one by hand.
// Callers still own the overlay div (and whatever click-outside behavior
// it has, if any) — this only replaces the sheet and its header.
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
    lockBodyScroll();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      // Focus trap (SIM-03): while the dialog is open, Tab/Shift+Tab must
      // cycle only through its own focusable descendants — without this,
      // Tab from the last field (or Shift+Tab from the first) escapes to
      // whatever's behind the overlay, which a modal must never allow.
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) { e.preventDefault(); sheet.focus(); return; }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !sheet.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last || !sheet.contains(active)) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    // onClose is re-created per render in most callers (inline arrow) — keying
    // this on mount only avoids tearing down/rebuilding focus state every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={sheetRef} style={M.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={sheetOnClick}>
      <div style={M.strip} />
      {/* h2: a modal is a sub-view opened from whatever page/screen (itself
          an h1) is behind it, so its own accessible title sits one level
          down — see CLAUDE.md's SIM-03 note for the full reasoning. */}
      <div style={M.head}><h2 style={M.title} id={titleId}>{title}</h2>{headExtra}</div>
      {children}
    </div>
  );
}

// Tracks whether a scrollable element has more content below its visible
// area — drives the fade-cue hint (#37) so it's only shown while there's
// somewhere left to scroll, and disappears once the user reaches the end.
// The element itself must be `position: relative` (S.scroll, S.scrollCap5,
// S.chatMsgs all are) so the cue — an absolutely-positioned child pinned to
// `bottom: 0` — stays fixed at the visible bottom edge of the scrollport
// instead of scrolling away with the content.
function useBottomScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [showFade, setShowFade] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);
  return { ref, showFade };
}

// Helpful Hints (#83) — orientation tips shown across the tabs, gated by a
// Profile-page master switch (HintsContext) plus each hint's own close
// button. Superseded #40's per-device localStorage dismiss: state is now
// per-user, server-persisted in profile.data (hintsEnabled/dismissedHints),
// so turning the switch off hides every hint and back on resets them all.
const HintsContext = createContext<{ enabled: boolean; dismissed: string[]; dismiss: (id: string) => void }>({
  enabled: false, dismissed: [], dismiss: () => {},
});

function FirstVisitTip({ id, children }: { id: string; children: ReactNode }) {
  const { enabled, dismissed, dismiss } = useContext(HintsContext);
  if (!enabled || dismissed.includes(id)) return null;
  return (
    <div style={S.tip}>
      <div style={S.tipText}>{children}</div>
      <button style={S.tipClose} onClick={() => dismiss(id)} aria-label="Dismiss tip">✕</button>
    </div>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────────
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Sunday of the local week containing `d`, as YYYY-MM-DD — the Sphere week
// runs Sunday through Saturday, resetting Saturday night at 11:59pm in
// whatever timezone the browser is actually in (plain, non-UTC Date methods
// already read the system/browser's local time, so this needs no explicit
// timezone handling of its own). The client is the source of truth for
// "what week is it" (#82, same reasoning as `?today=` elsewhere in this
// file: no per-user timezone anywhere in the schema).
function weekStartYmd(d: Date): string {
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return ymd(sunday);
}
// #115 — the Calendar tab's continuous-scroll range: a generous bounded
// window, not truly infinite, so scrolling and the sync button only ever
// work over data already fetched once — no fetch-on-scroll plumbing
// needed. 1.5 years back and 1.5 years forward, per direct user request
// (the original 1-back/6-forward window read as "the arrows stop working"
// once someone actually tried paging more than a couple months out).
function addMonths(d: Date, delta: number): Date {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + delta);
  return nd;
}
function calendarRange(): { start: Date; end: Date } {
  const start = addMonths(new Date(), -18);
  start.setDate(1);
  const end = addMonths(new Date(), 18);
  return { start, end };
}
interface CalendarDay { key: string; day: string; label: string; monthKey: string; monthLabel: string }
function calendarDays(): CalendarDay[] {
  const { start, end } = calendarRange();
  const days: CalendarDay[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push({
      key: ymd(cur),
      day: cur.toLocaleDateString("en-US", { weekday: "short" }),
      label: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      monthKey: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: cur.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
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
// #93 — additional reminder emails, not counting the account login email;
// matches MAX_REMINDER_EMAILS in routes/steward.ts (the server enforces
// this — this is just so the "Add email" button disables at the same point
// instead of letting a user fill the form out only to be rejected).
const MAX_REMINDER_EMAILS = 3;

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

  const [verse, setVerse] = useState<VerseEntry | null>(null);
  const [verseHistoryOpen, setVerseHistoryOpen] = useState(false);
  const [verseFavoritesOpen, setVerseFavoritesOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [journal, setJournal] = useState<Journal>({ reflect: "", commit_text: "", commitTextDate: null });
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
  const [deletedJobsOpen, setDeletedJobsOpen] = useState(false);
  const [closePursuitPrompt, setClosePursuitPrompt] = useState<Pursuit | null>(null);
  const [calendarAccounts, setCalendarAccounts] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [myAnswersOpen, setMyAnswersOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [priorityDetail, setPriorityDetail] = useState<Task | null>(null);
  const [completedLogOpen, setCompletedLogOpen] = useState(false);
  const [journalHistoryOpen, setJournalHistoryOpen] = useState(false);
  const [intentionHistoryOpen, setIntentionHistoryOpen] = useState(false);
  const [suggestedTone, setSuggestedTone] = useState<ToneVoice | null>(null);

  async function setTone(voice: ToneVoice) {
    setProfile(p => ({ ...(p ?? {}), voice }));
    setSuggestedTone(null);
    try {
      await apiFetch(`${API}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice }) });
    } catch { /* optimistic update already applied; a stale read on next load self-corrects */ }
  }

  async function setRemindersEnabled(remindersEnabled: boolean) {
    setProfile(p => ({ ...(p ?? {}), remindersEnabled }));
    try {
      await apiFetch(`${API}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remindersEnabled }) });
    } catch { /* optimistic update already applied; a stale read on next load self-corrects */ }
  }

  // Turning the switch on always resets dismissedHints — that's what makes
  // a repeat on->off->on bring every hint back, per #83.
  async function setHintsEnabled(enabled: boolean) {
    setProfile(p => ({ ...(p ?? {}), hintsEnabled: enabled, dismissedHints: enabled ? [] : (p?.dismissedHints ?? []) }));
    try {
      await apiFetch(`${API}/profile`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabled ? { hintsEnabled: true, dismissedHints: [] } : { hintsEnabled: false }),
      });
    } catch { /* optimistic update already applied; a stale read on next load self-corrects */ }
  }

  async function dismissHint(id: string) {
    const next = Array.from(new Set([...(profile?.dismissedHints ?? []), id]));
    setProfile(p => ({ ...(p ?? {}), dismissedHints: next }));
    try {
      await apiFetch(`${API}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismissedHints: next }) });
    } catch { /* optimistic update already applied; a stale read on next load self-corrects */ }
  }

  // #92 — clears the old interview transcript server-side, then sends the
  // user into the same Interview screen first-time onboarding uses.
  // ?restart=1 tells that screen to skip its normal "already onboarded,
  // bounce home" redirect for this one visit.
  async function redoInterview() {
    try {
      await apiFetch(`${API}/interview/restart`, { method: "POST" });
    } finally {
      setLocation("/interview?restart=1");
    }
  }

  async function sendTestReminder(): Promise<boolean> {
    try {
      const res = await apiFetch(`${API}/reminders/test`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  const refreshVerse = useCallback(() => {
    return getJson(`${API}/verse`, null).then((v) => v && setVerse(v as VerseEntry));
  }, []);

  // #115 — shared by the mount effect and the Calendar tab's sync button,
  // so tapping sync can't drift from what a fresh load would show. Every
  // GET /coming-up call is already a live Google Calendar pull with no
  // caching layer to bypass, so re-running this is a genuine full refresh.
  const refreshWeek = useCallback(() => {
    const { start, end } = calendarRange();
    return getList<Event>(`${API}/coming-up?start=${ymd(start)}&end=${ymd(end)}`).then(setWeek);
  }, []);

  const refreshProfile = useCallback(() => {
    return getJson(`${API}/profile`, null).then((d) => { if (isRecord(d) && isRecord(d.data)) setProfile(d.data as unknown as ProfileData); });
  }, []);

  async function toggleVerseFavorite(ref: string, favorite: boolean, customId?: number): Promise<boolean> {
    try {
      // A custom verse's favorited flag lives on its own row, not the
      // bank's verse-favorites table (see #96) — different endpoint.
      const res = customId
        ? await apiFetch(`${API}/my-verses/${customId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ favorited: favorite }),
          })
        : await apiFetch(`${API}/verse-favorites`, {
            method: favorite ? "POST" : "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ref }),
          });
      if (res.ok) setVerse(v => (v && v.ref === ref ? { ...v, favorited: favorite } : v));
      return res.ok;
    } catch {
      return false;
    }
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
    getJson(`${API}/journal`, null).then((d) => {
      if (isRecord(d)) setJournal({ reflect: String(d.reflect || ""), commit_text: String(d.commitText ?? d.commit_text ?? ""), commitTextDate: typeof d.commitTextDate === "string" ? d.commitTextDate : null });
    });
  }, []);

  async function savePulseCheck(category: PulseCategory, state: PulseState, note: string): Promise<boolean> {
    try {
      const r = await apiFetch(`${API}/pulse-checks`, {
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
    apiFetch(`${API}/interview/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { onboarded?: boolean } | null) => {
        if (d && d.onboarded === false) { setLocation("/interview"); }
      })
      .catch(() => {});

    refreshVerse();
    refreshJournal();
    getList<Event>(`${API}/coming-up`).then(setToday);
    refreshWeek();
    getList<Message>(`${API}/chat-history`).then((m) => setChat(prev => prev.length ? prev : m));
    getJson(`${API}/admin/is-admin`, { isAdmin: false }).then((d) => setIsAdmin(isRecord(d) && d.isAdmin === true));
    refreshProfile();
    refreshTasks(); refreshCommits(); refreshJobs(); refreshCalendarStatus(); refreshPulseChecks(); refreshRelationships(); refreshPursuits();
  }, [isAuthenticated, setLocation, refreshTasks, refreshCommits, refreshJobs, refreshCalendarStatus, refreshPulseChecks, refreshRelationships, refreshPursuits, refreshJournal, refreshProfile, refreshWeek]);

  async function saveJournal(next: Journal): Promise<boolean> {
    try {
      const r = await apiFetch(`${API}/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (r.ok) {
        // Only bump commitTextDate when the intention itself actually
        // changed (#94) — a reflect-only save shouldn't reset its clock.
        const commitChanged = next.commit_text !== journal.commit_text;
        setJournal({ ...next, commitTextDate: commitChanged ? ymd(new Date()) : journal.commitTextDate });
        return true;
      }
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
      // The server bounds its own OpenAI call at 30s and replies with a
      // friendly 504 if it's exceeded (#68) — this timeout must stay above
      // that so the server's graceful message always wins the race instead
      // of the client aborting first with a raw network error.
      const r = await apiFetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) }, 35_000);
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
    <HintsContext.Provider value={{ enabled: profile?.hintsEnabled === true, dismissed: profile?.dismissedHints ?? [], dismiss: dismissHint }}>
    <div style={R.root}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{display:none}input::placeholder,textarea::placeholder{color:${C.parchmentLow}}@keyframes micPulse{0%,100%{box-shadow:0 0 14px ${C.brassGlow}}50%{box-shadow:0 0 26px ${C.brassGlow},0 0 40px rgba(216,170,62,0.2)}}@keyframes calendarSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={R.woodLayer} />
      <div style={R.ambient} />

      {/* <header>/<main>, not <div> (#41 — axe's "region" rule: all page
          content must be contained by a landmark; the nav already had one
          via <nav aria-label="Main">, these two didn't). */}
      <header style={R.header}>
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
      </header>

      <main style={R.screen}>
        {tab === "today" && <Today verse={verse} tasks={tasks} journal={journal} events={today} name={user?.firstName} profile={profile} relationships={relationships} primaryRel={primaryRel} onSend={send} ci={ci} setCi={setCi} sending={sending} onSaveJournal={saveJournal} refreshTasks={refreshTasks} onOpenPriority={setPriorityDetail} onViewCompleted={() => setCompletedLogOpen(true)} pulseChecks={pulseChecks} onSavePulseCheck={savePulseCheck} onOpenJournalHistory={() => setJournalHistoryOpen(true)} onOpenIntentionHistory={() => setIntentionHistoryOpen(true)} onToggleVerseFavorite={toggleVerseFavorite} onOpenVerseHistory={() => setVerseHistoryOpen(true)} onOpenVerseFavorites={() => setVerseFavoritesOpen(true)} hasChatMessages={chat.length > 0} />}
        {tab === "her" && <Relationships relationships={relationships} refreshRelationships={refreshRelationships} commits={commits} refreshCommits={refreshCommits} />}
        {tab === "work" && <Work jobs={jobs} pursuits={pursuits} onJob={() => setJobModal(true)} onEdit={setEditJob} onAddPursuit={() => setPursuitModal(true)} onEditPursuit={setEditPursuit} onOpenClosed={() => setClosedPursuitsOpen(true)} onOpenDeletedJobs={() => setDeletedJobsOpen(true)} />}
        {tab === "sphere" && <Sphere />}
        {tab === "steward" && <StewardChat messages={chat} input={ci} setInput={setCi} send={() => send()} sending={sending} tasks={tasks} onOpenPriority={setPriorityDetail} tone={profile?.voice ?? "straight_talk"} onSetTone={setTone} suggestedTone={suggestedTone} />}
        {tab === "week" && <WeekView events={week} jobs={jobs} pursuits={pursuits} calendarAccounts={calendarAccounts} onRefresh={refreshWeek} onConnectCalendar={() => { window.location.href = `${API}/google-calendar/connect`; }} onDisconnectCalendar={async (email) => { try { await apiFetch(`${API}/google-calendar/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); refreshCalendarStatus(); } catch { /* ignore */ } }} />}
      </main>

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

      {jobModal && <JobModal pursuits={pursuits} onClose={() => setJobModal(false)} onCreated={refreshJobs} onPursuitCreated={refreshPursuits} />}
      {editJob && <JobEditModal job={editJob} pursuits={pursuits} onClose={() => setEditJob(null)} onSaved={maybePromptPursuitClose} onDeleted={refreshJobs} />}
      {pursuitModal && <PursuitModal onClose={() => setPursuitModal(false)} onSaved={refreshPursuits} />}
      {editPursuit && <PursuitModal pursuit={editPursuit} onClose={() => setEditPursuit(null)} onSaved={refreshPursuits} onDeleted={() => { refreshPursuits(); refreshJobs(); }} onClosed={refreshPursuits} />}
      {closedPursuitsOpen && <PursuitsClosedModal onClose={() => setClosedPursuitsOpen(false)} onChanged={refreshPursuits} />}
      {deletedJobsOpen && <JobsDeletedModal onClose={() => setDeletedJobsOpen(false)} onChanged={refreshJobs} />}
      {closePursuitPrompt && (
        <PursuitCloseFinishedPrompt
          pursuit={closePursuitPrompt}
          onClose={() => setClosePursuitPrompt(null)}
          onClosed={() => { setClosePursuitPrompt(null); refreshPursuits(); }}
        />
      )}
      {profileMenu && (
        <ProfileMenu
          name={user?.firstName} email={user?.email} onClose={() => setProfileMenu(false)} onLogout={logout}
          hintsEnabled={profile?.hintsEnabled === true} onSetHintsEnabled={setHintsEnabled}
          hasInterviewed={Boolean(profile?.name)}
          onOpenMyAnswers={() => { setProfileMenu(false); setMyAnswersOpen(true); }}
          onRedoInterview={() => { setProfileMenu(false); redoInterview(); }}
          onOpenReminders={() => { setProfileMenu(false); setRemindersOpen(true); }}
          onOpenTour={() => { setProfileMenu(false); setTourOpen(true); }}
        />
      )}
      {tourOpen && <AppTour onClose={() => setTourOpen(false)} />}
      {myAnswersOpen && (
        <MyAnswersModal
          profile={profile} relationshipCount={relationships.length} pursuitCount={pursuits.length}
          onClose={() => setMyAnswersOpen(false)} onSaved={refreshProfile}
          onOpenTribe={() => { setMyAnswersOpen(false); setTab("her"); }}
          onOpenWork={() => { setMyAnswersOpen(false); setTab("work"); }}
        />
      )}
      {remindersOpen && (
        <RemindersModal
          remindersEnabled={profile?.remindersEnabled ?? true} onSetRemindersEnabled={setRemindersEnabled}
          onSendTestReminder={sendTestReminder} onClose={() => setRemindersOpen(false)}
        />
      )}
      {priorityDetail && <PriorityDetailModal task={priorityDetail} onClose={() => setPriorityDetail(null)} onChanged={refreshTasks} />}
      {completedLogOpen && <CompletedLogModal onClose={() => setCompletedLogOpen(false)} onChanged={refreshTasks} />}
      {journalHistoryOpen && <JournalHistoryModal onClose={() => setJournalHistoryOpen(false)} onSaved={refreshJournal} />}
      {intentionHistoryOpen && <IntentionHistoryModal relationships={relationships} onClose={() => setIntentionHistoryOpen(false)} onCommitSaved={refreshCommits} onRelationshipAdded={refreshRelationships} />}
      {verseHistoryOpen && <VerseHistoryModal onClose={() => setVerseHistoryOpen(false)} onToggleFavorite={toggleVerseFavorite} />}
      {verseFavoritesOpen && <VerseFavoritesModal onClose={() => setVerseFavoritesOpen(false)} onToggleFavorite={toggleVerseFavorite} />}
    </div>
    </HintsContext.Provider>
  );
}

function ProfileMenu({ name, email, onClose, onLogout, hintsEnabled, onSetHintsEnabled, hasInterviewed, onOpenMyAnswers, onRedoInterview, onOpenReminders, onOpenTour }: {
  name?: string | null; email?: string | null; onClose: () => void; onLogout: () => void;
  hintsEnabled: boolean; onSetHintsEnabled: (enabled: boolean) => void;
  hasInterviewed: boolean; onOpenMyAnswers: () => void; onRedoInterview: () => void; onOpenReminders: () => void; onOpenTour: () => void;
}) {
  const [confirmRedo, setConfirmRedo] = useState(false);
  return (
    <div style={M.overlay} onClick={onClose}>
      <ModalSheet title={name || email || "Profile"} onClose={onClose} sheetOnClick={e => e.stopPropagation()}>
        {/* Helpful Hints (#83) — master switch over the per-tab <FirstVisitTip>
            close buttons; turning it on always resets any hints closed
            individually, so they all reappear. */}
        <button style={{ ...M.statusOpt, ...(hintsEnabled ? M.statusOptOn : {}) }} onClick={() => onSetHintsEnabled(!hintsEnabled)}>
          Helpful Hints: {hintsEnabled ? "On" : "Off"}
        </button>
        {/* #93 — moved here from the Chat tab: on/off toggle, which email(s)
            reminders go to, and the test-send button. */}
        <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentMid, boxShadow: "none" }} onClick={onOpenReminders}>
          Commitment Reminders
        </button>
        {/* #92 — a direct form over the onboarding-derived fields, no AI
            conversation. Works even if the interview was skipped (blank
            fields, fillable directly). */}
        <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentMid, boxShadow: "none" }} onClick={onOpenMyAnswers}>
          Edit My Answers
        </button>
        {/* #95 — replays the same post-onboarding app tour on demand. */}
        <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentMid, boxShadow: "none" }} onClick={onOpenTour}>
          Replay App Tour
        </button>
        {confirmRedo ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...S.prioSub, color: C.brass, marginBottom: 8, textAlign: "center" }}>
              {hasInterviewed
                ? "Redo the full interview? Anything the new conversation doesn't cover keeps its current answer."
                : "Take the full interview now?"}
            </div>
            <button style={M.next} onClick={onRedoInterview}>Yes, {hasInterviewed ? "redo it" : "let's go"}</button>
            <button style={M.cancel} onClick={() => setConfirmRedo(false)}>Cancel</button>
          </div>
        ) : (
          <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentMid, boxShadow: "none" }} onClick={() => setConfirmRedo(true)}>
            {hasInterviewed ? "Redo the Interview" : "Take the Full Interview"}
          </button>
        )}
        <a style={{ ...M.next, textDecoration: "none", display: "block", textAlign: "center" }} href="mailto:admin@lucasalign.com?subject=Steward%20feedback">Contact Support / Feedback</a>
        <button style={{ ...M.next, background: "none", border: "1px solid rgba(210,190,130,0.18)", color: C.parchmentDim, boxShadow: "none" }} onClick={onLogout}>Log Out</button>
        {/* Moved here from the signed-out gate (#35) — offered once someone's
            actually using Steward and looking for it, not pushed on every
            visitor before they've seen the product. */}
        <AddToHomeScreen />
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// #92 — "Edit My Answers": a direct form over the onboarding-derived
// fields, no AI conversation. Works even when profile is empty (skipped
// interview) — every field just starts blank and fillable. Relationships
// and pursuits are shown as a read-only count with a link to their own
// tabs, never edited here — they live in their own tables, and giving this
// screen a second, disconnected editor for them would just get them out
// of sync with Tribe/Work.
function MyAnswersModal({ profile, relationshipCount, pursuitCount, onClose, onSaved, onOpenTribe, onOpenWork }: {
  profile: ProfileData | null; relationshipCount: number; pursuitCount: number;
  onClose: () => void; onSaved: () => void; onOpenTribe: () => void; onOpenWork: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [seasonOfLife, setSeasonOfLife] = useState(profile?.season_of_life ?? "");
  const [topPriority, setTopPriority] = useState(profile?.core_identity?.top_priority ?? "");
  const [valuesText, setValuesText] = useState((profile?.core_identity?.values ?? []).join("\n"));
  const [decisionDrain, setDecisionDrain] = useState(profile?.planning_profile?.decision_drain ?? "");
  const [commonFailurePoint, setCommonFailurePoint] = useState(profile?.planning_profile?.common_failure_point ?? "");
  const [idealRhythm, setIdealRhythm] = useState(profile?.planning_profile?.ideal_rhythm ?? "");
  const [whereAiHelpsMost, setWhereAiHelpsMost] = useState(profile?.planning_profile?.where_ai_helps_most ?? "");
  const [doNotSuggestText, setDoNotSuggestText] = useState((profile?.guardrails?.do_not_suggest ?? []).join("\n"));
  const [alwaysRemindOf, setAlwaysRemindOf] = useState(profile?.guardrails?.always_remind_of ?? "");
  const saveStatus = useSaveStatus();

  async function save() {
    await saveStatus.save(async () => {
      const res = await apiFetch(`${API}/profile/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          season_of_life: seasonOfLife.trim(),
          core_identity: {
            worldview: profile?.core_identity?.worldview ?? null,
            top_priority: topPriority.trim() || null,
            values: valuesText.split("\n").map(v => v.trim()).filter(Boolean),
          },
          planning_profile: {
            decision_drain: decisionDrain.trim() || null,
            common_failure_point: commonFailurePoint.trim() || null,
            ideal_rhythm: idealRhythm.trim() || null,
            where_ai_helps_most: whereAiHelpsMost.trim() || null,
          },
          guardrails: {
            do_not_suggest: doNotSuggestText.split("\n").map(v => v.trim()).filter(Boolean),
            always_remind_of: alwaysRemindOf.trim() || null,
          },
        }),
      });
      if (res.ok) { onSaved(); return true; }
      return false;
    });
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="My Answers" onClose={onClose}>
        <div style={E.fieldGroup}>
          <div style={E.label}>NAME</div>
          <input style={M.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>SEASON OF LIFE</div>
          <input style={M.input} value={seasonOfLife} onChange={e => setSeasonOfLife(e.target.value)} placeholder="e.g. married, father of 3, running a business" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>TOP PRIORITY</div>
          <textarea style={M.input} rows={2} value={topPriority} onChange={e => setTopPriority(e.target.value)} placeholder="What comes first? What's non-negotiable?" />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>VALUES (ONE PER LINE)</div>
          <textarea style={M.input} rows={3} value={valuesText} onChange={e => setValuesText(e.target.value)} placeholder={"e.g. faithfulness\nplanning\nexecution"} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>WHERE DECISIONS DRAIN YOU</div>
          <textarea style={M.input} rows={2} value={decisionDrain} onChange={e => setDecisionDrain(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>WHERE EXECUTION BREAKS DOWN</div>
          <textarea style={M.input} rows={2} value={commonFailurePoint} onChange={e => setCommonFailurePoint(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>YOUR IDEAL PLANNING RHYTHM</div>
          <textarea style={M.input} rows={2} value={idealRhythm} onChange={e => setIdealRhythm(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>WHERE STEWARD HELPS MOST</div>
          <textarea style={M.input} rows={2} value={whereAiHelpsMost} onChange={e => setWhereAiHelpsMost(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>NEVER SUGGEST (ONE PER LINE)</div>
          <textarea style={M.input} rows={2} value={doNotSuggestText} onChange={e => setDoNotSuggestText(e.target.value)} />
        </div>
        <div style={E.fieldGroup}>
          <div style={E.label}>ALWAYS KEEP IN VIEW</div>
          <textarea style={M.input} rows={2} value={alwaysRemindOf} onChange={e => setAlwaysRemindOf(e.target.value)} />
        </div>

        <div style={{ ...S.card, marginTop: 4 }}>
          <div style={S.eyebrow}><h3 style={S.eyeText}>PEOPLE &amp; PURSUITS</h3></div>
          <div style={S.prioSub}>Managed from their own tabs, not here.</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <button style={S.prioLogLink} onClick={onOpenTribe}>{relationshipCount} {relationshipCount === 1 ? "person" : "people"} in Tribe ›</button>
            <button style={S.prioLogLink} onClick={onOpenWork}>{pursuitCount} in Work ›</button>
          </div>
        </div>

        <SaveStatus status={saveStatus.status} onRetry={save} />
        <button style={M.next} disabled={saveStatus.status === "saving"} onClick={save}>
          {saveStatus.status === "saving" ? "Saving…" : "Save"}
        </button>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// #93 — moved here from the Chat tab: the on/off toggle, which address
// reminders currently go to (only one is ever "active" — the account login
// email by default, or a verified additional one once switched to), and
// the test-send button.
function RemindersModal({ remindersEnabled, onSetRemindersEnabled, onSendTestReminder, onClose }: {
  remindersEnabled: boolean; onSetRemindersEnabled: (enabled: boolean) => void; onSendTestReminder: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<ReminderEmailEntry[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const addSave = useSaveStatus();
  const { error: addError, flash: flashAddError } = useTapError();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const verifySave = useSaveStatus();
  const { error: verifyError, flash: flashVerifyError } = useTapError();
  const rowError = useKeyedTapError<string>();
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const { error: testMsg, flash: flashTestMsg } = useTapError();

  const load = useCallback(() => { getList<ReminderEmailEntry>(`${API}/reminder-emails`).then(setEntries); }, []);
  useEffect(() => { load(); }, [load]);

  const additionalCount = (entries ?? []).filter(e => e.removable).length;

  async function addEmail() {
    const trimmed = newEmail.trim();
    if (!trimmed) { flashAddError("Enter an email address"); return; }
    let newId: string | null = null;
    const ok = await addSave.save(async () => {
      const res = await apiFetch(`${API}/reminder-emails`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        flashAddError((isRecord(body) && typeof body.error === "string") ? body.error : "Couldn't add — try again");
        return false;
      }
      const row = await res.json();
      newId = isRecord(row) && typeof row.id === "string" ? row.id : null;
      return true;
    });
    if (ok) {
      setNewEmail("");
      load();
      setVerifyingId(newId);
      setCodeInput("");
    }
  }

  async function resend(id: string) {
    setBusyIds(prev => [...prev, id]);
    const res = await apiFetch(`${API}/reminder-emails/${id}/resend`, { method: "POST" });
    if (!res.ok) rowError.flash(id, "Couldn't resend — try again");
    setBusyIds(prev => prev.filter(x => x !== id));
  }

  async function verifyCode() {
    if (!verifyingId) return;
    const ok = await verifySave.save(async () => {
      const res = await apiFetch(`${API}/reminder-emails/${verifyingId}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeInput.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        flashVerifyError((isRecord(body) && typeof body.error === "string") ? body.error : "That code isn't right. Try again.");
        return false;
      }
      return true;
    });
    if (ok) { setVerifyingId(null); setCodeInput(""); load(); }
  }

  async function activate(id: string) {
    setBusyIds(prev => [...prev, id]);
    const res = await apiFetch(`${API}/reminder-emails/${id}/activate`, { method: "POST" });
    if (res.ok) load();
    else rowError.flash(id, "Couldn't switch — try again");
    setBusyIds(prev => prev.filter(x => x !== id));
  }

  async function del(id: string) {
    setBusyIds(prev => [...prev, id]);
    const res = await apiFetch(`${API}/reminder-emails/${id}`, { method: "DELETE" });
    if (res.ok) { setConfirmDeleteId(null); load(); }
    else rowError.flash(id, "Couldn't remove — try again");
    setBusyIds(prev => prev.filter(x => x !== id));
  }

  async function handleSendTest() {
    setSendingTest(true);
    const ok = await onSendTestReminder();
    setSendingTest(false);
    flashTestMsg(ok ? "Test reminder sent — check your inbox" : "Couldn't send — try again");
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Commitment Reminders" onClose={onClose}>
        <button style={{ ...M.statusOpt, ...(remindersEnabled ? M.statusOptOn : {}) }} onClick={() => onSetRemindersEnabled(!remindersEnabled)}>
          Commitment reminders: {remindersEnabled ? "On" : "Off"}
        </button>

        {remindersEnabled && (
          <>
            <div style={{ marginTop: 16 }}>
              <div style={S.eyebrow}><h3 style={S.eyeText}>SENDS TO</h3></div>
              {(entries ?? []).map(entry => (
                <div key={entry.id} style={{ ...S.card, marginTop: 8 }}>
                  <div style={S.prioHeadRow}>
                    <div style={{ flex: 1 }}>
                      <div style={S.prioTitle}>{entry.email}</div>
                      <div style={S.prioSub}>
                        {entry.pending ? "Pending verification" : entry.active ? "Active — receiving reminders" : !entry.removable ? "Account email" : "Verified"}
                      </div>
                    </div>
                    {!entry.pending && !entry.active && (
                      <button style={S.prioLogLink} disabled={busyIds.includes(entry.id)} onClick={() => activate(entry.id)}>Make active</button>
                    )}
                  </div>
                  {entry.pending && (
                    verifyingId === entry.id ? (
                      <div style={{ marginTop: 8 }}>
                        <input style={M.input} value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} />
                        <TapError message={verifyError} />
                        <SaveStatus status={verifySave.status} onRetry={verifyCode} />
                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                          <button style={S.prioLogLink} disabled={verifySave.status === "saving"} onClick={verifyCode}>{verifySave.status === "saving" ? "Verifying…" : "Verify"}</button>
                          <button style={S.prioLogLink} disabled={busyIds.includes(entry.id)} onClick={() => resend(entry.id)}>{busyIds.includes(entry.id) ? "Sending…" : "Resend code"}</button>
                          <button style={S.prioLogLink} onClick={() => setVerifyingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button style={S.prioLogLink} onClick={() => { setVerifyingId(entry.id); setCodeInput(""); }}>Enter code</button>
                        <button style={S.prioLogLink} disabled={busyIds.includes(entry.id)} onClick={() => resend(entry.id)}>{busyIds.includes(entry.id) ? "Sending…" : "Resend code"}</button>
                      </div>
                    )
                  )}
                  {entry.removable && (
                    confirmDeleteId === entry.id ? (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ ...S.prioSub, color: "#C87060" }}>Remove this email? This can't be undone.</div>
                        <button style={{ ...S.prioLogLink, color: "#C87060" }} disabled={busyIds.includes(entry.id)} onClick={() => del(entry.id)}>
                          {busyIds.includes(entry.id) ? "Removing…" : "Yes, remove"}
                        </button>
                        <button style={{ ...S.prioLogLink, marginLeft: 12 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button style={{ ...S.prioLogLink, color: "#C87060", marginTop: 6 }} onClick={() => setConfirmDeleteId(entry.id)}>Remove</button>
                    )
                  )}
                  <TapError message={rowError.get(entry.id)} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={E.label}>ADD ANOTHER EMAIL{additionalCount >= MAX_REMINDER_EMAILS ? " (limit reached)" : ""}</div>
              <input
                style={M.input} value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="name@example.com" disabled={additionalCount >= MAX_REMINDER_EMAILS}
              />
              <TapError message={addError} />
              <SaveStatus status={addSave.status} onRetry={addEmail} />
              <button
                style={{ ...M.next, marginTop: 8 }}
                disabled={addSave.status === "saving" || additionalCount >= MAX_REMINDER_EMAILS}
                onClick={addEmail}
              >
                {addSave.status === "saving" ? "Adding…" : "Add email"}
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <button style={S.prioLogLink} disabled={sendingTest} onClick={handleSendTest}>{sendingTest ? "Sending…" : "Send test reminder"}</button>
              {testMsg && <div style={S.prioSub}>{testMsg}</div>}
            </div>
          </>
        )}

        <button style={{ ...M.cancel, marginTop: 16 }} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────
// #142/SIM-08 — a per-device "have they ever done this" latch. Two of the
// checklist's four signals below are day-scoped or session-only in the
// state Today already has (today's Pulse Check resets to empty every new
// day; `chat` messages, per Home()'s own `useState<Message[]>([])`, aren't
// persisted server-side to the client at all and reset on reload), so a
// live-only read would make the checklist un-complete itself the moment
// that state resets, even though the user genuinely did the thing once.
// This pins an item done forever, per device, the first time its live
// condition is true — same per-device localStorage idiom
// `useWeekVisibilityToggle` above already uses for this kind of UI-only,
// non-data-bearing state; no new backend/schema work.
function useLatchedFlag(storageKey: string, live: boolean): boolean {
  const [latched, setLatched] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (live && !latched) {
      setLatched(true);
      try { localStorage.setItem(storageKey, "1"); } catch { /* private browsing, etc. */ }
    }
  }, [live, latched, storageKey]);
  return latched || live;
}

// #142/SIM-08 — first-week checklist: set an intention, add one priority,
// complete a Pulse Check, message Steward (SIM-08's own recommended four).
// Self-hides once every item is done, or once dismissed — a long-time user
// who's already done all four (the overwhelmingly common case) never sees
// it; one who's missing an item and doesn't want the nudge can close it.
function FirstWeekChecklist({ hasIntention, hasPriority, pulseCheckedToday, hasChatMessages }: {
  hasIntention: boolean; hasPriority: boolean; pulseCheckedToday: boolean; hasChatMessages: boolean;
}) {
  const pulseChecked = useLatchedFlag("steward:checklist-pulse-done", pulseCheckedToday);
  const messaged = useLatchedFlag("steward:checklist-chat-done", hasChatMessages);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("steward:checklist-dismissed") === "1"; } catch { return false; }
  });
  const items: { id: string; label: string; done: boolean }[] = [
    { id: "intention", label: "Set today's intention", done: hasIntention },
    { id: "priority", label: "Add one priority", done: hasPriority },
    { id: "pulse", label: "Complete a Pulse Check", done: pulseChecked },
    { id: "chat", label: "Message Steward", done: messaged },
  ];
  const allDone = items.every(i => i.done);
  if (dismissed || allDone) return null;
  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem("steward:checklist-dismissed", "1"); } catch { /* private browsing, etc. */ }
  }
  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={S.eyeText}>GET STARTED THIS WEEK</h2>
        <button style={S.tipClose} onClick={dismiss} aria-label="Dismiss checklist">✕</button>
      </div>
      <div style={{ fontSize: 12, color: C.parchmentDim, marginBottom: 10 }}>Four small steps to get the most out of Steward.</div>
      {items.map(i => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
          <span aria-hidden="true" style={{ fontSize: 15, color: i.done ? C.brass : C.parchmentLow }}>{i.done ? "✓" : "○"}</span>
          <span style={{ fontSize: 14, color: i.done ? C.parchmentDim : C.parchment, textDecoration: i.done ? "line-through" : "none" }}>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function Today({ verse, tasks, journal, events, name, profile, relationships, primaryRel, onSend, ci, setCi, sending, onSaveJournal, refreshTasks, onOpenPriority, onViewCompleted, pulseChecks, onSavePulseCheck, onOpenJournalHistory, onOpenIntentionHistory, onToggleVerseFavorite, onOpenVerseHistory, onOpenVerseFavorites, hasChatMessages }: {
  verse: VerseEntry | null; tasks: Task[]; journal: Journal; events: Event[]; name?: string | null;
  profile: ProfileData | null; relationships: Relationship[]; primaryRel: Relationship | null;
  onSend: (m?: string) => void; ci: string; setCi: (v: string) => void; sending: boolean;
  onSaveJournal: (j: Journal) => Promise<boolean>; refreshTasks: () => void;
  onOpenPriority: (t: Task) => void; onViewCompleted: () => void;
  pulseChecks: PulseCheckEntry[]; onSavePulseCheck: (category: PulseCategory, state: PulseState, note: string) => Promise<boolean>;
  onOpenJournalHistory: () => void; onOpenIntentionHistory: () => void;
  onToggleVerseFavorite: (ref: string, favorite: boolean, customId?: number) => Promise<boolean>; onOpenVerseHistory: () => void; onOpenVerseFavorites: () => void;
  hasChatMessages: boolean;
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
  const { error: addTaskError, flash: flashAddTaskError } = useTapError();
  // SIM-06 — priority entry had no visible Cancel and Escape did nothing.
  // addPriorityBtnRef/restoreFocusOnAddingClose mirror ModalSheet's own
  // Escape-to-close + on-close focus restore idiom (this block is a plain
  // inline conditional render, not a ModalSheet, so it doesn't get that for
  // free) — restoreFocusOnAddingClose is only set by cancelAdding, so a
  // successful Add (which also flips `adding` back to false) doesn't yank
  // focus away from wherever the user's attention naturally lands next.
  const addPriorityBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusOnAddingClose = useRef(false);
  useEffect(() => { setIntent(journal.commit_text); setReflect(journal.reflect); }, [journal.commit_text, journal.reflect]);
  // #94 — Marriage Intention persists until changed; this is the "hasn't
  // been updated in a while" note, purely informational, gone the moment
  // it's saved again (commitTextDate bumps on save, see saveJournal).
  const INTENTION_STALE_DAYS = 7;
  const intentionStaleDays = journal.commitTextDate
    ? Math.round((new Date(ymd(new Date())).getTime() - new Date(journal.commitTextDate).getTime()) / 86400000)
    : null;
  const intentionStale = intentionStaleDays !== null && intentionStaleDays >= INTENTION_STALE_DAYS;

  const [favoritingVerse, setFavoritingVerse] = useState(false);
  const { error: verseFavError, flash: flashVerseFavError } = useTapError();
  async function handleToggleVerseFavorite() {
    if (!verse || favoritingVerse) return;
    setFavoritingVerse(true);
    const ok = await onToggleVerseFavorite(verse.ref, !verse.favorited, verse.custom ? verse.id : undefined);
    setFavoritingVerse(false);
    if (!ok) flashVerseFavError("Couldn't save — try again");
  }

  const hr = new Date().getHours();
  const greeting = `Good ${hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening"}${name ? `, ${name}` : ""}.`;
  const openTasks = tasks.filter(t => !deletingIds.includes(t.id));
  const visibleTasks = prioritiesExpanded ? openTasks : openTasks.slice(0, PRIORITIES_VISIBLE_CAP);
  const hiddenTaskCount = openTasks.length - visibleTasks.length;
  const journalPrompt = rotatingItem(journalPromptsFor(profile, relationships));
  // Existence-based, not tied to who's starred/primary — "no spouse in the
  // picture" means checking the whole Tribe list, not just the top pick.
  // Family/friend/other and an empty list all fall into "Friendship".
  const hasSpouseRel = relationships.some(r => r.category === "spouse");
  const hasChildRel = relationships.some(r => r.category === "child");
  const intentionKind: "marriage" | "parenting" | "friendship" = hasSpouseRel ? "marriage" : hasChildRel ? "parenting" : "friendship";
  const intentionLabel = intentionKind === "marriage" ? "MARRIAGE INTENTION" : intentionKind === "parenting" ? "PARENTING INTENTION" : "FRIENDSHIP INTENTION";
  const intentionPlaceholder = intentionKind === "marriage"
    ? "What's your intention for your marriage today?"
    : intentionKind === "parenting"
      ? "What's your intention for your kids today?"
      : primaryRel?.name
        ? `What's your intention with ${primaryRel.name} today?`
        : "What's your intention for the people who matter most today?";

  async function addTask() {
    const t = newTask.trim();
    if (!t) { flashAddTaskError("Type a priority before adding it"); return; }
    const ok = await addTaskSave.save(async () => {
      const r = await apiFetch(`${API}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      if (r.ok) refreshTasks();
      return r.ok;
    });
    if (ok) { setNewTask(""); setAdding(false); }
  }
  function cancelAdding() {
    setNewTask("");
    if (addTaskSave.status === "error") addTaskSave.reset();
    restoreFocusOnAddingClose.current = true;
    setAdding(false);
  }
  // Escape closes the priority-entry input the same way Cancel does —
  // scoped to while it's actually open, added/removed via this effect,
  // same idiom as ModalSheet's own onKeyDown (above).
  useEffect(() => {
    if (!adding) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cancelAdding();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [adding]);
  useEffect(() => {
    if (!adding && restoreFocusOnAddingClose.current) {
      restoreFocusOnAddingClose.current = false;
      addPriorityBtnRef.current?.focus();
    }
  }, [adding]);
  async function complete(id: number): Promise<boolean> {
    try {
      const r = await apiFetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
      if (r.ok) refreshTasks();
      return r.ok;
    } catch {
      return false;
    }
  }
  async function deleteTask(id: number): Promise<boolean> {
    setDeletingIds(prev => prev.includes(id) ? prev : [...prev, id]);
    try {
      const r = await apiFetch(`${API}/tasks/${id}`, { method: "DELETE" });
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
      const r = await apiFetch(`${API}/tasks/${id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ymd(new Date()) }),
      });
      if (r.ok) refreshTasks();
      return r.ok;
    } catch {
      return false;
    }
  }

  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  return (
    <div ref={scrollFade.ref} style={S.scroll}>
      {scrollFade.showFade && <div style={S.scrollFadeCue} />}
      <div className="today-greet-row" style={S.greetRow}>
        <div><h1 style={S.greet}>{greeting}</h1><div style={S.greetSub}>Let's build something that matters.</div></div>
        <div style={S.dateChip}><Icon name="cal" size={13} color={C.parchmentMid} /><span style={{ marginLeft: 6 }}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
      </div>

      <FirstVisitTip id="today">This is your daily home base — set today's intention, check your top priorities, log a Pulse Check, and reflect before you're done.</FirstVisitTip>

      <FirstWeekChecklist
        hasIntention={journal.commit_text.trim().length > 0}
        hasPriority={tasks.length > 0}
        pulseCheckedToday={pulseChecks.length > 0}
        hasChatMessages={hasChatMessages}
      />

      {/* #38: plain card, not the brass-glow hero border this used to have
          — Verse of the Day is read-only, non-actionable content, so it
          shouldn't outrank the actionable cards below it. */}
      <div style={S.cardCentered}>
        <div style={{ ...S.prioHeadRow, width: "100%", marginBottom: 12 }}>
          <div style={{ ...S.eyebrow, marginBottom: 0 }}><Icon name="book" /><h2 style={S.eyeText}>VERSE OF THE DAY</h2></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={S.prioLogLink} onClick={onOpenVerseHistory}>History ›</button>
            <button style={S.prioLogLink} onClick={onOpenVerseFavorites}>Favorites ›</button>
          </div>
        </div>
        <div style={S.verseText}>{verse?.text || "…"}</div>
        {verse?.ref && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <div style={S.verseRef}>{verse.ref.toUpperCase()}</div>
            {verse.custom && <span style={{ ...S.upTag, ...S.myVerseTag }}>MY VERSE</span>}
            <button
              style={S.verseStarBtn}
              onClick={handleToggleVerseFavorite}
              disabled={favoritingVerse}
              aria-label={verse.favorited ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={verse.favorited}
            >
              <span style={{ color: verse.favorited ? C.brass : C.parchmentDim }}>★</span>
            </button>
          </div>
        )}
        <TapError message={verseFavError} />
      </div>

      <div style={S.cardCentered}>
        <div style={{ ...S.prioHeadRow, width: "100%" }}>
          <div style={{ ...S.eyebrow, marginBottom: 0 }}><Icon name="heart" /><h2 id="intention-label" style={S.eyeText}>{intentionLabel}</h2></div>
          <button style={S.prioLogLink} onClick={onOpenIntentionHistory}>History ›</button>
        </div>
        <textarea
          style={S.intentInput}
          value={intent}
          rows={2}
          placeholder={intentionPlaceholder}
          aria-labelledby="intention-label"
          onChange={e => { setIntent(e.target.value); if (introSave.status === "error") introSave.reset(); }}
          onBlur={() => { if (intent !== journal.commit_text) introSave.save(() => onSaveJournal({ ...journal, commit_text: intent })); }}
        />
        <SaveStatus status={introSave.status} onRetry={() => introSave.save(() => onSaveJournal({ ...journal, commit_text: intent }))} />
        {intentionStale && <div style={{ fontSize: 12, color: C.brassSoft, marginTop: 6 }}>You haven't updated this in a while.</div>}
      </div>

      <div style={S.card}>
        <div style={S.prioHeadRow}>
          <div style={S.eyebrow}><Icon name="target" /><h2 style={S.eyeText}>PRIORITIES</h2></div>
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
                style={S.logInput} value={newTask} autoFocus placeholder="Next priority…"
                onChange={e => { setNewTask(e.target.value); if (addTaskSave.status === "error") addTaskSave.reset(); }}
                onKeyDown={e => { if (e.key === "Enter") addTask(); }}
              />
              <button style={S.logBtn} disabled={!newTask.trim()} onClick={addTask}>Add</button>
              <button style={S.prioLogLink} onClick={cancelAdding}>Cancel</button>
            </div>
            <SaveStatus status={addTaskSave.status} onRetry={addTask} />
            <TapError message={addTaskError} />
          </div>
        ) : (
          <button ref={addPriorityBtnRef} style={{ ...S.intakeBtn, marginTop: 14 }} onClick={() => setAdding(true)}>＋  Add a priority</button>
        )}
      </div>

      <PulseCheckCard pulseChecks={pulseChecks} onSave={onSavePulseCheck} />

      <div style={S.card}>
        <div style={S.eyebrow}><Icon name="cal" /><h2 style={S.eyeText}>COMING UP</h2></div>
        {events.length === 0 ? (
          <div style={S.empty}>Nothing scheduled today.</div>
        ) : (
          <div style={S.upRow}>
            {events.slice(0, 3).map((u, i, arr) => (
              <div key={u.id} style={{ ...S.upCol, ...(i < arr.length - 1 ? S.upBorder : {}) }}>
                <div style={S.upTime}><Icon name="clock" size={12} color={C.brassSoft} /><span style={{ marginLeft: 5 }}>{u.time}</span></div>
                <div style={S.upTitle} title={u.title}>{briefTitle(u.title)}</div>
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
            <div style={S.eyebrow}><Icon name="pen" /><h2 style={S.eyeText}>DAILY JOURNAL PROMPT</h2></div>
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
const PULSE_STATE_LABEL: Record<PulseState, string> = { down: "down", mid: "steady", up: "up" };
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
      <div style={S.eyebrow}><Icon name="sun" /><h2 style={S.eyeText}>PULSE CHECK</h2></div>
      <div style={S.pulseSub}>How are you holding up?</div>
      <FirstVisitTip id="pulse-check">A quick daily check on how work, family, and faith are actually going — not a task list, just an honest read.</FirstVisitTip>
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
    // A press starting on a button (checkbox, expand arrow, Edit) shouldn't
    // start a swipe-capture at all — capturing the pointer here redirects
    // the eventual native "click" to this row div instead of the button
    // underneath, which silently swallows the click for mouse users (touch
    // taps aren't affected the same way, which is why this went unnoticed
    // until testing with a mouse). Swiping still works from anywhere else
    // on the row.
    if ((e.target as HTMLElement).closest("button")) return;
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

// A commitment's target is either 1+ existing Tribe relationships, or a
// one-time ad hoc name + category (#60/#72) — never neither.
function commitTargetLabel(c: Commit, byId: Map<number, Relationship>): string {
  const names = c.relationshipIds.map((id) => byId.get(id)).filter((r): r is Relationship => Boolean(r)).map(relationshipLabel);
  if (names.length > 0) return names.join(", ");
  if (c.adHocName) return c.adHocName;
  return "someone";
}
// Category only makes sense to show for a single target — a mixed-category
// multi-person commitment (e.g. spouse + child) has no one clean label, so
// this stays blank for anything but exactly one Tribe person.
function commitTargetSub(c: Commit, byId: Map<number, Relationship>): string {
  if (c.relationshipIds.length === 1) {
    const r = byId.get(c.relationshipIds[0]!);
    if (r) return RELATIONSHIP_CATEGORY_LABEL[r.category];
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
  // Marking a commitment kept needs a second tap to confirm, matching
  // Priorities' one-off complete-confirm — reopening a kept one, and the
  // swipe-revealed "Kept" cue, stay single-tap since those are already
  // deliberate actions.
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);
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
  function tapDot() {
    if (toggling || deleting || confirmed) return;
    if (commit.done) { runToggle(); return; }
    if (!confirming) {
      setConfirming(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    setConfirmed(true);
    setToggling(true);
    // Hold the confirmed checkmark for a beat before it actually moves to Kept.
    setTimeout(async () => {
      const ok = await onToggleDone(commit.id, true);
      setToggling(false);
      if (!ok) { setConfirmed(false); flash("Couldn't save — try again"); }
    }, 1000);
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
  const showGreen = commit.done || confirming || confirmed;
  const showCheck = commit.done || confirmed;

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
          <button
            style={{ ...S.dot, ...(showGreen ? S.dotDone : {}) }}
            disabled={toggling} onClick={tapDot}
            aria-label={commit.done ? "Reopen" : confirming ? "Tap again to confirm" : "Mark kept"}
          >
            {showCheck ? "✓" : ""}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ ...S.prioTitle, textDecoration: commit.done ? "line-through" : "none" }}>{commit.text}</div>
            {confirming ? (
              <div style={{ ...S.prioSub, color: "#7AB46A" }}>Tap again to confirm</div>
            ) : (
              <div style={S.prioSub}>
                For {who}{sub ? ` (${sub})` : ""} · Said {commit.madeDate}
                {age.label && <span style={{ color: ageColor, marginLeft: 6 }}>{age.label}</span>}
              </div>
            )}
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
  // false | {} for a plain "Log a commitment", or a locked+prefilled entry
  // handed off from a person's profile (#72) — see addAsCommitment below.
  const [logOpen, setLogOpen] = useState<false | { lockedPerson?: { id: number; label: string }; initialText?: string }>(false);
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
  // #137 — auto-generated, once-a-day rotating version of this line.
  // Fetched lazily (only once this tab actually renders, and only when
  // there's a primary person to generate about) and cached server-side for
  // the rest of the day; this local fallback covers the load-in moment and
  // the no-relationships-at-all case, where there's nothing to fetch.
  const [generatedIntention, setGeneratedIntention] = useState<string | null>(null);
  useEffect(() => {
    setGeneratedIntention(null);
    if (!primaryRel) return;
    let cancelled = false;
    getJson(`${API}/tribe-intention?relationshipId=${primaryRel.id}`, null).then(d => {
      if (!cancelled && isRecord(d) && typeof d.text === "string") setGeneratedIntention(d.text);
    });
    return () => { cancelled = true; };
  }, [primaryRel?.id]);
  const intentionText = generatedIntention ?? (primaryRel?.name
    ? `Ask ${primaryRel.name} about their week before you talk about yours.`
    : "Log commitments to the people who matter most — spouse, kids, parents, close friends.");
  const open = commits.filter(c => !c.done && !deletingIds.includes(c.id));
  const done = commits.filter(c => c.done && !deletingIds.includes(c.id));

  async function setCommitDone(id: number, doneVal: boolean): Promise<boolean> {
    try {
      const r = await apiFetch(`${API}/commits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: doneVal }) });
      if (r.ok) { refreshCommits(); return true; }
    } catch { /* fall through */ }
    return false;
  }
  async function deleteCommit(id: number): Promise<boolean> {
    setDeletingIds(prev => prev.includes(id) ? prev : [...prev, id]);
    try {
      const r = await apiFetch(`${API}/commits/${id}`, { method: "DELETE" });
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
      const res = await apiFetch(`${API}/relationships/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: !r.starred }) });
      if (res.ok) { refreshRelationships(); return; }
    } catch { /* fall through */ }
    primaryTapError.flash(r.id, "Couldn't save — try again");
  }
  async function reorderGroup(starred: boolean, orderedIds: number[]) {
    try {
      const res = await apiFetch(`${API}/relationships/reorder`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred, orderedIds }),
      });
      if (res.ok) { refreshRelationships(); return; }
    } catch { /* fall through */ }
    flashOrderError("Couldn't save the new order — try again");
  }
  async function resetPeopleOrder() {
    await resetSave.save(async () => {
      const r = await apiFetch(`${API}/relationships/reset`, { method: "POST" });
      if (r.ok) { refreshRelationships(); setResetConfirmOpen(false); return true; }
      return false;
    });
  }

  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  const openCommitsFade = useBottomScrollFade<HTMLDivElement>();
  return (
    <div ref={scrollFade.ref} style={S.scroll}>
      {scrollFade.showFade && <div style={S.scrollFadeCue} />}
      <h1 style={S.pageTitle}>Tribe</h1>
      <div style={S.pageSub}>The people you're prioritizing.</div>
      <FirstVisitTip id="tribe">Track the people you're prioritizing — spouse, kids, family, friends — and the commitments you've made to them.</FirstVisitTip>
      <div style={S.card}><div style={S.eyebrow}><Icon name="heart" /><h2 style={S.eyeText}>TODAY'S INTENTION</h2></div><div style={S.intent}>{intentionText}</div></div>

      <div style={S.card}>
        <div style={S.prioHeadRow}>
          <div style={S.eyebrow}><h2 style={S.eyeText}>PEOPLE</h2></div>
          <div>
            {relationships.length > 0 && <button style={S.prioLogLink} onClick={() => setResetConfirmOpen(true)}>Reset order</button>}
            <button style={{ ...S.prioLogLink, marginLeft: 12 }} onClick={() => setDeletedPeopleOpen(true)}>Deleted ›</button>
          </div>
        </div>
        <TapError message={orderError} />
        {relationships.length === 0 ? (
          <div style={S.empty}>No one added yet. Start with the person you want to prioritize most.</div>
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
      <button style={{ ...S.intakeBtn, marginBottom: 4 }} onClick={() => setLogOpen({})}>＋  Log a commitment</button>

      {open.length > 0 && (
        <div style={S.card}>
          <div style={S.eyebrow}><h2 style={S.eyeText}>OPEN</h2></div>
          <div ref={openCommitsFade.ref} style={S.scrollCap5}>
            {openCommitsFade.showFade && <div style={S.scrollFadeCue} />}
            {open.map(c => (
              <SwipeCommitment key={c.id} commit={c} byId={byId} onToggleDone={setCommitDone} onDelete={deleteCommit} onEdit={setEditingCommit} />
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div style={{ ...S.card, opacity: 0.85 }}>
          <div style={S.eyebrow}><h2 style={S.eyeText}>KEPT</h2></div>
          {done.slice(0, KEPT_VISIBLE_CAP).map(c => (
            <SwipeCommitment key={c.id} commit={c} byId={byId} onToggleDone={setCommitDone} onDelete={deleteCommit} onEdit={setEditingCommit} />
          ))}
        </div>
      )}
      {addOpen && <RelationshipModal onClose={() => setAddOpen(false)} onSaved={refreshRelationships} />}
      {editing && (
        <RelationshipModal
          relationship={editing} onClose={() => setEditing(null)} onSaved={refreshRelationships}
          onDeleted={() => { refreshRelationships(); refreshCommits(); }}
          onAddAsCommitment={(person, text) => { setEditing(null); setLogOpen({ lockedPerson: { id: person.id, label: relationshipLabel(person) }, initialText: text }); }}
        />
      )}
      {logOpen && (
        <CommitLogModal
          relationships={relationships} lockedPerson={logOpen.lockedPerson} initialText={logOpen.initialText}
          onClose={() => setLogOpen(false)} onSaved={refreshCommits} onRelationshipAdded={refreshRelationships}
        />
      )}
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
// multi-select 1+ existing Tribe relationships, or name someone new under a
// category and choose whether it's a one-time thing or worth adding to
// Tribe (#60/#72). Selecting a new-category chip clears any existing-Tribe
// selections and vice versa — ad-hoc and Tribe targeting stay mutually
// exclusive. `lockedIds` (only ever passed by CommitLogModal, when opened
// from a specific person's profile) renders those chips selected and
// un-toggleable — #72's "can't swap out who started it," creation-time
// only, so CommitEditModal never passes this.
function CommitTargetPicker({ relationships, relationshipIds, setRelationshipIds, lockedIds, newCategory, setNewCategory, newName, setNewName, addToTribe, setAddToTribe }: {
  relationships: Relationship[];
  relationshipIds: number[]; setRelationshipIds: (v: number[]) => void;
  lockedIds?: number[];
  newCategory: RelationshipCategory | ""; setNewCategory: (v: RelationshipCategory | "") => void;
  newName: string; setNewName: (v: string) => void;
  addToTribe: boolean; setAddToTribe: (v: boolean) => void;
}) {
  const hasNew = newCategory !== "" && newName.trim() !== "";
  const locked = new Set(lockedIds ?? []);
  function toggleExisting(id: number) {
    if (locked.has(id)) return;
    const isSelected = relationshipIds.includes(id);
    // #72: never let a direct deselect take the set to zero — switching to
    // an ad-hoc target instead goes through "Someone new" below, which
    // clears the set as an intentional mode switch, not a bare removal.
    if (isSelected && relationshipIds.length === 1) return;
    setRelationshipIds(isSelected ? relationshipIds.filter(existing => existing !== id) : [...relationshipIds, id]);
    setNewCategory(""); setNewName(""); setAddToTribe(false);
  }
  function pickNewCategory(cat: RelationshipCategory) {
    setNewCategory(cat);
    setRelationshipIds([...locked]);
  }
  return (
    <>
      <div style={E.fieldGroup}>
        <div style={E.label}>WHO IS THIS TO?</div>
        {relationships.length > 0 && (
          <div style={E.chipRow}>
            {relationships.map(r => (
              <button key={r.id} style={{ ...E.chip, ...(relationshipIds.includes(r.id) ? { background: C.brass, color: C.ink } : {}), ...(locked.has(r.id) ? { cursor: "default" } : {}) }} onClick={() => toggleExisting(r.id)}>
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
  const r = await apiFetch(`${API}/relationships`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, category, type: "", notes: "", commitments: "", biggestChallenge: "" }),
  });
  if (!r.ok) return null;
  const created = await r.json();
  return created.id ?? null;
}

// ── Log a commitment modal ──────────────────────────────────────────────────
// `lockedPerson` + `initialText` (#72) are only passed when opened via a
// specific person's "Add this as an open commitment" button (RelationshipModal)
// — that person starts pre-selected and un-removable for the rest of this
// creation flow, and the free-text Commitments field's current value seeds
// the commitment text. Neither carries any special meaning once saved: a
// later edit treats everyone the same.
function CommitLogModal({ relationships, lockedPerson, initialText, defaultNewCategory, onClose, onSaved, onRelationshipAdded }: {
  relationships: Relationship[]; lockedPerson?: { id: number; label: string }; initialText?: string; defaultNewCategory?: RelationshipCategory;
  onClose: () => void; onSaved: () => void; onRelationshipAdded: () => void;
}) {
  const [relationshipIds, setRelationshipIds] = useState<number[]>(lockedPerson ? [lockedPerson.id] : []);
  const [newCategory, setNewCategory] = useState<RelationshipCategory | "">(defaultNewCategory ?? "");
  const [newName, setNewName] = useState("");
  const [addToTribe, setAddToTribe] = useState(false);
  const [text, setText] = useState(initialText ?? "");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const saveStatus = useSaveStatus();
  const [validationErr, setValidationErr] = useState("");

  const hasExisting = relationshipIds.length > 0;
  const hasNew = newCategory !== "" && newName.trim() !== "";
  const canSave = text.trim() !== "";

  async function save() {
    if (!canSave) return;
    if (!hasExisting && !hasNew) { setValidationErr("Select who this commitment is for."); return; }
    setValidationErr("");
    await saveStatus.save(async () => {
      let targetRelationshipIds = relationshipIds;
      if (!hasExisting && hasNew && addToTribe) {
        const createdId = await createAdHocRelationship(newName.trim(), newCategory as RelationshipCategory);
        if (createdId === null) return false;
        targetRelationshipIds = [createdId];
      }
      const body: Record<string, unknown> = { text: text.trim(), notes: notes.trim(), dueDate: dueDate || null };
      if (targetRelationshipIds.length > 0) body.relationshipIds = targetRelationshipIds;
      else { body.adHocName = newName.trim(); body.adHocCategory = newCategory; }
      const r = await apiFetch(`${API}/commits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        if (targetRelationshipIds.length > 0 && addToTribe) onRelationshipAdded();
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
          relationshipIds={relationshipIds} setRelationshipIds={setRelationshipIds}
          lockedIds={lockedPerson ? [lockedPerson.id] : undefined}
          newCategory={newCategory} setNewCategory={setNewCategory}
          newName={newName} setNewName={setNewName}
          addToTribe={addToTribe} setAddToTribe={setAddToTribe}
        />
        <TapError message={validationErr || null} />

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
  const [relationshipIds, setRelationshipIds] = useState<number[]>(commit.relationshipIds);
  const [newCategory, setNewCategory] = useState<RelationshipCategory | "">(commit.relationshipIds.length > 0 ? "" : (commit.adHocCategory ?? ""));
  const [newName, setNewName] = useState(commit.relationshipIds.length > 0 ? "" : (commit.adHocName ?? ""));
  const [addToTribe, setAddToTribe] = useState(false);
  const [text, setText] = useState(commit.text);
  const [notes, setNotes] = useState(commit.notes);
  const [dueDate, setDueDate] = useState(commit.dueDate ?? "");
  const saveStatus = useSaveStatus();
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [validationErr, setValidationErr] = useState("");

  const hasExisting = relationshipIds.length > 0;
  const hasNew = newCategory !== "" && newName.trim() !== "";
  const canSave = text.trim() !== "";

  async function save() {
    if (!canSave) return;
    if (!hasExisting && !hasNew) { setValidationErr("Select who this commitment is for."); return; }
    setValidationErr("");
    await saveStatus.save(async () => {
      let targetRelationshipIds = relationshipIds;
      if (!hasExisting && hasNew && addToTribe) {
        const createdId = await createAdHocRelationship(newName.trim(), newCategory as RelationshipCategory);
        if (createdId === null) return false;
        targetRelationshipIds = [createdId];
      }
      const body: Record<string, unknown> = { text: text.trim(), notes: notes.trim(), dueDate: dueDate || null };
      if (targetRelationshipIds.length > 0) body.relationshipIds = targetRelationshipIds;
      else { body.adHocName = newName.trim(); body.adHocCategory = newCategory; }
      const r = await apiFetch(`${API}/commits/${commit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        if (targetRelationshipIds.length > 0 && addToTribe) onRelationshipAdded();
        onSaved(); onClose();
        return true;
      }
      return false;
    });
  }

  async function del() {
    setDeleting(true);
    try {
      const r = await apiFetch(`${API}/commits/${commit.id}`, { method: "DELETE" });
      if (r.ok) { onDeleted(); onClose(); }
      else { setDelErr("Couldn't delete. Try again."); setDeleting(false); }
    } catch { setDelErr("Couldn't reach the server."); setDeleting(false); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Edit Commitment" onClose={onClose}>
        <CommitTargetPicker
          relationships={relationships}
          relationshipIds={relationshipIds} setRelationshipIds={setRelationshipIds}
          newCategory={newCategory} setNewCategory={setNewCategory}
          newName={newName} setNewName={setNewName}
          addToTribe={addToTribe} setAddToTribe={setAddToTribe}
        />
        <TapError message={validationErr || null} />

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
  const keptFade = useBottomScrollFade<HTMLDivElement>();
  const deletedFade = useBottomScrollFade<HTMLDivElement>();

  const load = useCallback(() => {
    apiFetch(`${API}/commits/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Shared by both lists — "done: false" reopens a kept commitment,
  // "deleted: false" restores a deleted one.
  async function reopen(id: number, body: { done: boolean } | { deleted: boolean }) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/commits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
        <div ref={keptFade.ref} style={S.scrollCap5}>
          {keptFade.showFade && <div style={S.scrollFadeCue} />}
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
        <div ref={deletedFade.ref} style={S.scrollCap5}>
          {deletedFade.showFade && <div style={S.scrollFadeCue} />}
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
function RelationshipModal({ relationship, onClose, onSaved, onDeleted, onAddAsCommitment }: {
  relationship?: Relationship; onClose: () => void; onSaved: () => void; onDeleted?: () => void;
  // #72 — only meaningful (and only ever passed) once the person already
  // has a real id to attach a commitment to; a brand-new, not-yet-saved
  // person has to be saved first, then reopened, to use it.
  onAddAsCommitment?: (person: Relationship, text: string) => void;
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
        ? await apiFetch(`${API}/relationships/${relationship.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await apiFetch(`${API}/relationships`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { onSaved(); onClose(); return true; }
      return false;
    });
  }

  async function del() {
    if (!relationship) return;
    setDeleting(true);
    try {
      const r = await apiFetch(`${API}/relationships/${relationship.id}`, { method: "DELETE" });
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
          {/* Generic — a personal note only ever shown in this window, not
              tracked or due-dated (#72). This button is the bridge into a
              real, trackable commitment when one's actually warranted. */}
          {relationship && onAddAsCommitment && (
            <button style={{ ...S.prioLogLink, marginTop: 8 }} onClick={() => onAddAsCommitment(relationship, commitments)}>
              Add this as an open commitment ›
            </button>
          )}
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
  const scrollFade = useBottomScrollFade<HTMLDivElement>();

  const load = useCallback(() => {
    apiFetch(`${API}/relationships/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reactivate(id: number) {
    setBusyIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/relationships/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
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
      const r = await apiFetch(`${API}/relationships/${id}/permanent`, { method: "DELETE" });
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
        <div ref={scrollFade.ref} style={S.scrollCap5}>
          {scrollFade.showFade && <div style={S.scrollFadeCue} />}
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
function Work({ jobs, pursuits, onJob, onEdit, onAddPursuit, onEditPursuit, onOpenClosed, onOpenDeletedJobs }: {
  jobs: Job[]; pursuits: Pursuit[]; onJob: () => void; onEdit: (j: Job) => void;
  onAddPursuit: () => void; onEditPursuit: (p: Pursuit) => void; onOpenClosed: () => void; onOpenDeletedJobs: () => void;
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

  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  return (
    <div ref={scrollFade.ref} style={S.scroll}>
      {scrollFade.showFade && <div style={S.scrollFadeCue} />}
      <h1 style={S.pageTitle}>Work</h1>
      {/* #142/SIM-08: names what a "pursuit" is (a job, a business, a
          volunteer role — anything you group work under) directly in the
          always-visible subtitle, since the FirstVisitTip below only ever
          shows once. */}
      <div style={S.pageSub}>Active jobs grouped by pursuit — a job, a business, a volunteer role, anything ongoing you're pursuing. Tap a row to edit.</div>
      <FirstVisitTip id="work">Group your jobs under pursuits — a job, a business, a volunteer role — to see progress at a glance.</FirstVisitTip>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 2 }}>
        <button style={S.prioLogLink} onClick={onOpenDeletedJobs}>Deleted Jobs ›</button>
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
                {/* h2: this pursuit's name is this group of job rows'
                    section heading — kept interactive (opens the pursuit
                    editor) by nesting the existing button inside it, per
                    the standard "heading wraps a control" pattern. */}
                <h2 style={{ margin: 0 }}>
                  <button style={{ ...S.workGroup, color, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onEditPursuit(p)}>
                    {p.name.toUpperCase()}
                  </button>
                </h2>
                {pursuitJobs.length === 0
                  ? <div style={{ ...S.empty, textAlign: "left", padding: "0 0 10px" }}>No jobs yet.</div>
                  : pursuitJobs.map(j => renderJobRow(j, color))}
              </div>
            );
          })}
          {unsorted.length > 0 && (
            <div>
              <h2 style={S.workGroup}>UNSORTED</h2>
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

// ── Sphere ───────────────────────────────────────────────────────────────────
// #82 — weekly self-examination across Protect (Family/Yourself/Community),
// Provide, and Lead. "Sphere Landscape" was chosen after three rendered
// prototypes were reviewed live — see issue #82's grilling resolution and
// the prototype/sphere-dashboard-visual-options branch (never merged,
// kept as a primary source per this project's prototype convention).
const SPHERE_STATE_SCORE: Record<PulseState, number> = { down: 0, mid: 0.5, up: 1 };

// The "ghost fade" mechanic: a week's visual weight blends how recent it is
// with how long that state persisted, so a state held for many consecutive
// weeks leaves a longer-lingering (fainter but real) mark than a one-week
// blip — a genuine recent turnaround should visibly outweigh a stretch
// that's already faded, not look identical to one that just happened to end.
function sphereGhostOpacity(weeks: SphereWeek[]): number[] {
  const n = weeks.length;
  const runLen: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (weeks[i].state === "none") { runLen[i] = 0; continue; }
    runLen[i] = i > 0 && weeks[i - 1].state === weeks[i].state ? runLen[i - 1] + 1 : 1;
  }
  return weeks.map((w, i) => {
    if (w.state === "none") return 0;
    if (i === n - 1) return 1;
    const age = (n - 1) - i;
    const recency = Math.max(0.15, 1 - age / n);
    const persistence = Math.min(1, runLen[i] / 6);
    return Math.min(1, recency * (0.35 + 0.65 * persistence));
  });
}

// All 5 categories as one layered ridgeline chart — each ribbon's height is
// that category's state, its fill fading toward the ghost weight above.
function SphereLandscapeChart({ categories }: { categories: SphereDashboardCategory[] }) {
  const W = 320, rowH = 34;
  const H = rowH * categories.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} width="100%" height={H + 4} role="img" aria-label="Sphere, trend over the last 3 months">
      {categories.map((cat, ci) => {
        const n = cat.weeks.length;
        if (n < 2) return null;
        const baseY = rowH * ci + rowH * 0.72, amp = rowH * 0.6;
        const opac = sphereGhostOpacity(cat.weeks);
        const top = cat.weeks.map((w, i) => {
          const x = (i / (n - 1)) * W;
          const score = w.state === "none" ? 0.5 : SPHERE_STATE_SCORE[w.state];
          const y = baseY - score * amp;
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
        const bottom = cat.weeks.map((_w, ri) => {
          const i = n - 1 - ri;
          const x = (i / (n - 1)) * W;
          return `L${x.toFixed(1)},${(baseY + 6).toFixed(1)}`;
        }).join(" ");
        const cur = cat.weeks[n - 1]!;
        const curState: PulseState = cur.state === "none" ? "mid" : cur.state;
        const avgOpacity = opac.reduce((a, o) => a + o, 0) / n * 0.5 + 0.12;
        const label = SPHERE_CATEGORIES.find(c => c.id === cat.category)?.label ?? cat.category;
        return (
          <g key={cat.category}>
            <path d={`${top} ${bottom} Z`} fill={PULSE_STATE_COLOR[curState]} opacity={Math.min(0.85, avgOpacity)} />
            <circle cx={W} cy={(baseY - SPHERE_STATE_SCORE[curState] * amp).toFixed(1)} r={4} fill={PULSE_STATE_COLOR[curState]} />
            <text x={6} y={rowH * ci + 13} fontSize={10} fill={C.parchmentDim} letterSpacing="0.04em">{label.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Small sparkline-with-dots version of the same idea, for the recent-weeks
// window shown under each category's own heading. Ramps up from however many
// weeks have actually been logged (1, 2, 3...) rather than always demanding
// 4 (#88) — `weeks` is the full 12-week dashboard array, padded with "none"
// placeholders back to before the user ever touched Sphere, and those
// leading placeholders shouldn't count as gaps the way a genuinely skipped
// week (one after their first-ever entry) still should.
function SphereMiniMeter({ weeks }: { weeks: SphereWeek[] }) {
  const firstLoggedIdx = weeks.findIndex(w => w.state !== "none");
  if (firstLoggedIdx === -1) return null;
  const shown = weeks.slice(Math.max(firstLoggedIdx, weeks.length - 4));
  const n = shown.length;
  const w = 132, h = 34;
  const opac = sphereGhostOpacity(shown);
  const pts = shown.map((wk, i) => {
    const x = n > 1 ? (i / (n - 1)) * w : w / 2;
    const score = wk.state === "none" ? 0.5 : SPHERE_STATE_SCORE[wk.state];
    return [x, h - 5 - score * (h - 10)] as const;
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
        {n > 1 && <path d={linePath} fill="none" stroke={C.brassSoft} strokeWidth={2} opacity={0.85} />}
        {shown.map((wk, i) => {
          const [x, y] = pts[i]!;
          if (wk.state === "none") return <circle key={i} cx={x} cy={y} r={2.8} fill="none" stroke={C.parchmentLow} strokeDasharray="1.5,1.5" opacity={0.6} />;
          return <circle key={i} cx={x} cy={y} r={i === n - 1 ? 4 : 2.8} fill={PULSE_STATE_COLOR[wk.state]} opacity={i === n - 1 ? 1 : opac[i]} />;
        })}
      </svg>
      <span style={{ fontSize: 11, color: C.parchmentLow }}>{n === 1 ? "This week" : `${n}-wk trend`}</span>
    </div>
  );
}

function sphereMonthLabel(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-US", { month: "long" });
}

function SphereStatePill({ state }: { state: PulseState | null }) {
  if (!state) return <div style={{ fontSize: 11, color: C.parchmentLow, fontStyle: "italic" }}>not logged</div>;
  return (
    <div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: `1px solid ${PULSE_STATE_COLOR[state]}`, color: PULSE_STATE_COLOR[state] }}>
      {PULSE_STATE_LABEL[state]}
    </div>
  );
}

// Small expand/collapse section, same idea as CommitRow's expand panel —
// used inside the Details drill-downs so a category's Answers/Notes stay
// out of the way until asked for.
function SphereCollapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <button style={S.sphereDropdownBtn} onClick={() => setOpen(o => !o)}>
        {label} {open ? "▴" : "▾"}
      </button>
      {open && <div style={S.sphereDropdownPanel}>{children}</div>}
    </div>
  );
}

// Full drill-down for one week's check-ins — every category's itemized
// walkthrough answers (if any) and every bit of free text the user actually
// typed, each behind its own collapsible section per #82 follow-up.
function SphereWeekDetailModal({ checks, onClose }: { checks: SphereCheckEntry[]; onClose: () => void }) {
  const byCategory = new Map(checks.map(c => [c.category, c]));
  return (
    <div style={M.overlay}>
      <ModalSheet title="This Week — Details" onClose={onClose}>
        {SPHERE_CATEGORIES.map(cat => {
          const entry = byCategory.get(cat.id);
          const questions = SPHERE_QUESTIONS[cat.id];
          const answers = entry?.answers ?? null;
          const hasAnswers = !!answers && answers.some(a => a.answer !== null);
          const freeText: { q: string; text: string }[] = [];
          if (entry?.note) freeText.push({ q: "Note", text: entry.note });
          answers?.forEach((a, i) => {
            const text = [a.note, a.followup].filter(Boolean).join(" — ");
            if (text) freeText.push({ q: questions[i]?.text ?? `Question ${i + 1}`, text });
          });
          return (
            <div key={cat.id} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(210,190,130,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 15, color: C.parchment, fontWeight: 600 }}>{cat.label}</div>
                <SphereStatePill state={entry?.state ?? null} />
              </div>
              {!entry ? (
                <div style={{ fontSize: 12, color: C.parchmentLow, fontStyle: "italic" }}>Not checked in yet this week.</div>
              ) : (
                <>
                  <SphereCollapsible label="Answers">
                    {hasAnswers ? questions.map((q, i) => {
                      const a = answers![i];
                      const mark = a.answer === "up" ? "✓" : a.answer === "mid" ? "±" : a.answer === "down" ? "✕" : "○";
                      const color = a.answer === "up" ? "#8FAE6E" : a.answer === "mid" ? C.brassSoft : a.answer === "down" ? "#C87060" : C.parchmentLow;
                      return (
                        <div key={i} style={{ marginBottom: 8, fontSize: 12.5, color: C.parchmentMid }}>
                          <span style={{ color }}>{mark}</span> {q.text}
                        </div>
                      );
                    }) : <div style={{ fontSize: 12, color: C.parchmentLow, fontStyle: "italic" }}>No walkthrough this week — set with the battery icons instead.</div>}
                  </SphereCollapsible>
                  <SphereCollapsible label="Notes">
                    {freeText.length > 0 ? freeText.map((f, i) => (
                      <div key={i} style={{ marginBottom: 8, fontSize: 12.5 }}>
                        <div style={{ color: C.parchmentLow, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.q}</div>
                        <div style={{ color: C.parchmentMid }}>{f.text}</div>
                      </div>
                    )) : <div style={{ fontSize: 12, color: C.parchmentLow, fontStyle: "italic" }}>Nothing written down.</div>}
                  </SphereCollapsible>
                </>
              )}
            </div>
          );
        })}
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// Brief per-category recap for one month — the week-by-week state sequence
// plus only the notes the user actually wrote that month, truncated. Not a
// full itemized replay like SphereWeekDetailModal — a month can span 4+
// weeks of walkthrough answers, so this stays to the big picture.
function SphereMonthDetailModal({ month, onClose }: { month: SphereMonth; onClose: () => void }) {
  return (
    <div style={M.overlay}>
      <ModalSheet title={`${sphereMonthLabel(month.month)} — Details`} onClose={onClose}>
        {month.categories.map(c => {
          const label = SPHERE_CATEGORIES.find(sc => sc.id === c.category)?.label ?? c.category;
          const notedWeeks = c.weeks.filter(w => w.note);
          return (
            <div key={c.category} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(210,190,130,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 14, color: C.parchment, fontWeight: 600 }}>{label}</div>
                <SphereStatePill state={c.state} />
              </div>
              {c.weeks.length === 0 ? (
                <div style={{ fontSize: 12, color: C.parchmentLow, fontStyle: "italic" }}>Not logged this month.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, color: C.parchmentDim }}>{c.weeks.map(w => PULSE_STATE_LABEL[w.state]).join(" → ")}</div>
                  {notedWeeks.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {notedWeeks.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.parchmentMid, marginTop: 4 }}>&ldquo;{w.note.slice(0, 140)}&rdquo;</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// 6-month-max monthly browser (#82) — a brass medallion showing one blended
// score per month, prev/next arrows. Only ever shows months that actually
// have data; never padded out with empty ones. "This Week" sits above it as
// its own always-current section, each with its own Details drill-down.
function SphereHistoryModal({ onClose, thisWeekChecks }: { onClose: () => void; thisWeekChecks: SphereCheckEntry[] }) {
  const [months, setMonths] = useState<SphereMonth[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [weekDetailOpen, setWeekDetailOpen] = useState(false);
  const [monthDetailOpen, setMonthDetailOpen] = useState(false);
  useEffect(() => {
    getJson(`${API}/sphere/history`, null).then(d => {
      const list = isRecord(d) && Array.isArray(d.months) ? d.months as SphereMonth[] : [];
      setMonths(list);
      setIdx(Math.max(0, list.length - 1));
    });
  }, []);
  const m = months && months.length > 0 ? months[idx] : null;
  const thisWeekByCategory = new Map(thisWeekChecks.map(c => [c.category, c]));
  return (
    <div style={M.overlay}>
      <ModalSheet title="Sphere History" onClose={onClose}>
        <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid rgba(210,190,130,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={S.eyeText}>THIS WEEK</h3>
            <button style={S.prioLogLink} onClick={() => setWeekDetailOpen(true)}>Details ›</button>
          </div>
          {SPHERE_CATEGORIES.map(cat => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 2px" }}>
              <div style={{ fontSize: 13.5, color: C.parchmentMid }}>{cat.label}</div>
              <SphereStatePill state={thisWeekByCategory.get(cat.id)?.state ?? null} />
            </div>
          ))}
        </div>
        {months === null ? (
          <div style={S.empty}>Loading…</div>
        ) : !m ? (
          <div style={S.empty}>Nothing to show yet — check in for a few weeks first.</div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 16 }}>
              <button style={{ ...S.prioLogLink, ...(idx === 0 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => setIdx(i => i - 1)} aria-label="Previous month">‹</button>
              <div style={{ fontSize: 16, color: C.parchment, fontWeight: 600, minWidth: 100, textAlign: "center" }}>{sphereMonthLabel(m.month)}</div>
              <button style={{ ...S.prioLogLink, ...(idx === months.length - 1 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => setIdx(i => i + 1)} aria-label="Next month">›</button>
            </div>
            {m.categories.map(c => {
              const label = SPHERE_CATEGORIES.find(sc => sc.id === c.category)?.label ?? c.category;
              return (
                <div key={c.category} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid rgba(210,190,130,0.08)" }}>
                  <div style={{ fontSize: 13.5, color: C.parchmentMid }}>{label}</div>
                  <SphereStatePill state={c.state} />
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 12, borderTop: "1px dashed rgba(210,190,130,0.18)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.brassSoft, fontWeight: 700 }}>Overall</div>
              <div style={{ fontSize: 18, color: C.parchment, fontWeight: 600 }}>{Math.round(m.score * 100)}%</div>
            </div>
            <button style={{ ...S.prioLogLink, marginTop: 10 }} onClick={() => setMonthDetailOpen(true)}>Details ›</button>
            <div style={{ ...S.empty, marginTop: 14 }}>Showing {months.length} of up to 6 months — only months with data appear.</div>
          </div>
        )}
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
      {weekDetailOpen && <SphereWeekDetailModal checks={thisWeekChecks} onClose={() => setWeekDetailOpen(false)} />}
      {monthDetailOpen && m && <SphereMonthDetailModal month={m} onClose={() => setMonthDetailOpen(false)} />}
    </div>
  );
}

// Guided weekly review over one category's fixed question list — an
// alternative, itemized way to arrive at the same state+note a battery-icon
// tap sets directly (#82). Works on its own draft, cloned from whatever was
// last saved; only "Use this" commits it, so backing out any other way
// (mid-walkthrough Close, or Close without saving on the summary) always
// leaves the prior saved answers (or nothing, if none were ever saved)
// exactly as they were.
function SphereWalkthroughModal({ category, label, savedAnswers, onClose, onSave }: {
  category: SphereCategory; label: string; savedAnswers: SphereAnswer[] | null;
  onClose: () => void; onSave: (state: PulseState, answers: SphereAnswer[]) => Promise<boolean>;
}) {
  const questions = SPHERE_QUESTIONS[category];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SphereAnswer[]>(() => savedAnswers ? savedAnswers.map(a => ({ ...a })) : sphereBlankAnswers(questions));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const atSummary = step >= questions.length;
  const q = atSummary ? null : questions[step];
  const a = atSummary ? null : draft[step];

  function updateCurrent(patch: Partial<SphereAnswer>) {
    setDraft(prev => prev.map((entry, i) => i === step ? { ...entry, ...patch } : entry));
  }

  const upCount = draft.filter(x => x.answer === "up").length;
  const downCount = draft.filter(x => x.answer === "down").length;
  const suggested: PulseState = upCount >= questions.length * 0.7 ? "up" : downCount >= questions.length * 0.4 ? "down" : "mid";
  const suggestedColor = suggested === "up" ? "#8FAE6E" : suggested === "mid" ? C.brassSoft : "#C87060";

  async function handleUseThis() {
    setSaving(true);
    const ok = await onSave(suggested, draft);
    if (ok) onClose();
    else { setSaving(false); setSaveErr("Couldn't save — try again"); }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title={`Walk through: ${label}`} onClose={onClose}>
        {atSummary ? (
          <>
            <div style={S.sphereSummaryBox}>
              {questions.map((qq, i) => {
                const ans = draft[i];
                const mark = ans.answer === "up" ? "✓" : ans.answer === "mid" ? "±" : ans.answer === "down" ? "✕" : "○";
                const color = ans.answer === "up" ? "#8FAE6E" : ans.answer === "mid" ? C.brassSoft : ans.answer === "down" ? "#C87060" : C.parchmentLow;
                const extra = [ans.note, ans.followup].filter(Boolean).join(" — ");
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <span style={{ color }}>{mark}</span> {qq.text}
                    {extra && <div style={{ color: C.parchmentLow, fontSize: 11.5, marginTop: 2 }}>↳ {extra}</div>}
                  </div>
                );
              })}
            </div>
            <div style={S.sphereQuestion}>Suggested state: <b style={{ color: suggestedColor }}>{suggested.toUpperCase()}</b> — the note and state stay yours to edit before saving.</div>
            <TapError message={saveErr || null} />
            <div style={S.sphereWizNav}>
              <button style={S.sphereWizBtn} onClick={() => setStep(questions.length - 1)}>‹ Review answers</button>
              <button style={{ ...S.sphereWizBtn, ...S.sphereWizBtnPrimary }} disabled={saving} onClick={handleUseThis}>{saving ? "Saving…" : "Use this ✓"}</button>
            </div>
            <button style={{ ...S.sphereWizBtn, ...S.sphereWizBtnDanger }} onClick={onClose}>Close without saving</button>
          </>
        ) : q && a && (
          <>
            <div style={S.sphereProgress}>
              {questions.map((_qq, i) => <div key={i} style={{ ...S.sphereDot, ...(i < step ? S.sphereDotDone : i === step ? S.sphereDotCurrent : {}) }} />)}
            </div>
            <div style={S.sphereStepLabel}>Question {step + 1} of {questions.length} — {label}</div>
            <div style={S.sphereQuestion}>{q.text}</div>
            <div style={S.sphereAnswerRow}>
              {SPHERE_ANSWER_SETS[q.type].map(([state, answerLabel]) => (
                <button
                  key={state}
                  style={{ ...S.sphereAnswerBtn, ...(a.answer === state ? { borderColor: PULSE_STATE_COLOR[state], color: PULSE_STATE_COLOR[state] } : {}) }}
                  onClick={() => updateCurrent({ answer: state })}
                >
                  {answerLabel}
                </button>
              ))}
            </div>
            {!a.answer && <div role="status" aria-live="polite" style={{ ...S.sphereFieldLabel, margin: "8px 0 0" }}>Select an answer to continue</div>}
            <div style={S.sphereFieldLabel}>Add a note — elaborate on your answer (optional)</div>
            <textarea style={{ ...M.input, resize: "none" }} rows={2} value={a.note} onChange={e => updateCurrent({ note: e.target.value })} />

            {a.answer && (q.type === "struggle" ? (
              <div style={S.sphereFollowup}>
                {a.answer === "down" ? (
                  <>
                    <div style={S.sphereFollowupQ}>{q.subQuestion}</div>
                    <div style={S.sphereAnswerRow}>
                      {(["yes", "no"] as const).map(sub => (
                        <button
                          key={sub}
                          style={{ ...S.sphereAnswerBtn, flex: "none", minWidth: 70, ...(a.subAnswer === sub ? { borderColor: sub === "yes" ? "#8FAE6E" : "#C87060", color: sub === "yes" ? "#8FAE6E" : "#C87060" } : {}) }}
                          onClick={() => updateCurrent({ subAnswer: sub })}
                        >
                          {sub === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                    {a.subAnswer && (
                      <>
                        <div style={S.sphereFieldLabel}>{a.subAnswer === "yes" ? q.workingYesLabel : q.workingNoLabel}</div>
                        <textarea style={{ ...M.input, resize: "none" }} rows={2} value={a.followup} onChange={e => updateCurrent({ followup: e.target.value })} />
                      </>
                    )}
                  </>
                ) : a.answer === "mid" ? (
                  <>
                    <div style={S.sphereFollowupQ}>{q.someFollowup}</div>
                    <textarea style={{ ...M.input, resize: "none" }} rows={2} value={a.followup} onChange={e => updateCurrent({ followup: e.target.value })} />
                  </>
                ) : (
                  <div style={S.sphereFollowupQ}>{q.notReallyResponse}</div>
                )}
              </div>
            ) : (
              <div style={S.sphereFollowup}>
                <div style={S.sphereFollowupQ}>{sphereFollowupFor(q, a.answer)}</div>
                <textarea style={{ ...M.input, resize: "none" }} rows={2} value={a.followup} onChange={e => updateCurrent({ followup: e.target.value })} />
              </div>
            ))}

            <div style={S.sphereWizNav}>
              <button style={{ ...S.sphereWizBtn, ...(step === 0 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => setStep(s => s - 1)}>‹ Back</button>
              <button style={{ ...S.sphereWizBtn, ...S.sphereWizBtnPrimary, ...(!a.answer ? { opacity: 0.3 } : {}) }} disabled={!a.answer} onClick={() => setStep(s => s + 1)}>
                {step === questions.length - 1 ? "See summary ›" : "Next ›"}
              </button>
            </div>
            <button style={{ ...S.sphereWizBtn, marginTop: 10, width: "100%" }} onClick={onClose}>Close</button>
          </>
        )}
      </ModalSheet>
    </div>
  );
}

function Sphere() {
  const [checks, setChecks] = useState<SphereCheckEntry[]>([]);
  const [dashboard, setDashboard] = useState<SphereDashboardCategory[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<SphereCategory, string>>>({});
  const [pendingState, setPendingState] = useState<Partial<Record<SphereCategory, PulseState>>>({});
  const { error: tapError, flash } = useTapError();
  const noteSave = useKeyedSaveStatus<SphereCategory>();
  const byCategory = new Map(checks.map(c => [c.category, c]));
  const dashByCategory = new Map((dashboard ?? []).map(d => [d.category, d]));

  // Guards against a battery-icon tap's optimistic update losing a race
  // against the initial GET /sphere still in flight from mount: if that GET
  // resolves after a tap's POST already landed, its `.then(setChecks)` would
  // otherwise stomp the fresh state with the pre-tap snapshot it fetched
  // earlier — the tap would visibly glow, then revert. Bumped by both a new
  // fetch and every successful write, so a write always invalidates any
  // still-pending fetch that started before it.
  const checksVersion = useRef(0);
  const refreshChecks = useCallback(() => {
    const v = ++checksVersion.current;
    getList<SphereCheckEntry>(`${API}/sphere?week=${weekStartYmd(new Date())}`).then(list => {
      if (v === checksVersion.current) setChecks(list);
    });
  }, []);
  const refreshDashboard = useCallback(() => {
    getJson(`${API}/sphere/dashboard`, null).then(d => {
      setDashboard(isRecord(d) && Array.isArray(d.categories) ? d.categories as SphereDashboardCategory[] : []);
    });
  }, []);
  useEffect(() => { refreshChecks(); refreshDashboard(); }, [refreshChecks, refreshDashboard]);

  const [walkthroughCategory, setWalkthroughCategory] = useState<SphereCategory | null>(null);

  // `answers` omitted entirely (not just undefined) means "don't touch
  // whatever was last saved there" — a manual battery-icon tap or a plain
  // note edit must never blank out a previously-saved walkthrough.
  async function saveCheck(category: SphereCategory, state: PulseState, note: string, answers?: SphereAnswer[]): Promise<boolean> {
    try {
      const body: Record<string, unknown> = { week: weekStartYmd(new Date()), category, state, note };
      if (answers !== undefined) body.answers = answers;
      const r = await apiFetch(`${API}/sphere`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        checksVersion.current++;
        setChecks(prev => [...prev.filter(c => c.category !== category), { category, state, note, answers: answers ?? prev.find(c => c.category === category)?.answers ?? null }]);
        return true;
      }
      return false;
    } catch { return false; }
  }
  async function tapState(category: SphereCategory, state: PulseState) {
    const existing = byCategory.get(category);
    setPendingState(prev => ({ ...prev, [category]: state }));
    const ok = await saveCheck(category, state, existing?.note ?? "");
    setPendingState(prev => { const next = { ...prev }; delete next[category]; return next; });
    if (ok) refreshDashboard();
    else flash("Couldn't save — try again");
  }
  function saveNote(category: SphereCategory, entry: SphereCheckEntry) {
    const note = drafts[category] ?? entry.note;
    if (note === entry.note) return;
    noteSave.save(category, () => saveCheck(category, entry.state, note));
  }
  async function saveWalkthrough(category: SphereCategory, state: PulseState, answers: SphereAnswer[]): Promise<boolean> {
    const existing = byCategory.get(category);
    const ok = await saveCheck(category, state, existing?.note ?? "", answers);
    if (ok) refreshDashboard();
    return ok;
  }

  const groups: { name: string | null; items: typeof SPHERE_CATEGORIES }[] = [];
  for (const cat of SPHERE_CATEGORIES) {
    const g = groups.find(g => g.name === cat.group);
    if (g) g.items.push(cat); else groups.push({ name: cat.group, items: [cat] });
  }
  const dashboardEmpty = dashboard !== null && dashboard.every(d => d.weeks.every(w => w.state === "none"));

  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  return (
    <div ref={scrollFade.ref} style={S.scroll}>
      {scrollFade.showFade && <div style={S.scrollFadeCue} />}
      <h1 style={S.pageTitle}>Sphere</h1>
      {/* #142/SIM-08: this subtitle is the one place the term "Sphere" gets
          defined for a user who's dismissed or never seen the FirstVisitTip
          below (a one-time tip; this line is always visible). */}
      <div style={S.pageSub}>Your Sphere of Influence — the people and responsibilities you protect, provide for, and lead. A weekly check-in, not a daily one.</div>
      <FirstVisitTip id="sphere">A weekly check-in on how you're protecting, providing for, and leading the people around you.</FirstVisitTip>

      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={S.eyeText}>SPHERE DASHBOARD</h2>
          <button style={S.prioLogLink} onClick={() => setHistoryOpen(true)}>History ›</button>
        </div>
        <div style={{ fontSize: 11, color: C.parchmentLow, marginBottom: 10 }}>This week's check-in resets Saturday night at 11:59 PM, your time.</div>
        {dashboard === null ? (
          <div style={S.empty}>Loading…</div>
        ) : dashboardEmpty ? (
          <div style={S.empty}>Your Sphere history builds here — check in weekly to watch it grow.</div>
        ) : (
          <SphereLandscapeChart categories={dashboard} />
        )}
        <div style={{ fontSize: 12, color: C.parchmentDim, marginTop: 10, lineHeight: 1.5 }}>Five currents, one Sphere — each area&apos;s height is this week&apos;s state; older weeks fade unless they held for a while, so a real turnaround still outweighs a stretch that&apos;s already passed.</div>
      </div>

      {groups.map(group => (
        <div key={group.name ?? "ungrouped"}>
          {group.name && <h2 style={{ ...S.eyeText, margin: "22px 0 10px" }}>{group.name.toUpperCase()}</h2>}
          {group.items.map(cat => {
            const entry = byCategory.get(cat.id);
            const displayState = pendingState[cat.id] ?? entry?.state;
            const dashCat = dashByCategory.get(cat.id);
            return (
              <div key={cat.id} style={S.card}>
                <div style={S.pulseRowTop}>
                  <div>
                    <h2 style={{ fontSize: 16, color: C.parchment, fontWeight: 600 }}>{cat.label}</h2>
                    {cat.hint && <div style={{ fontSize: 12, color: C.parchmentDim, marginTop: 2 }}>{cat.hint}</div>}
                  </div>
                  <div style={S.pulseBtns}>
                    {(["down", "mid", "up"] as PulseState[]).map(s => (
                      <button
                        key={s}
                        style={{ ...S.pulseBtn, width: 44, height: 44, ...(displayState === s ? { borderColor: PULSE_STATE_COLOR[s], color: PULSE_STATE_COLOR[s], boxShadow: `0 0 8px ${PULSE_STATE_COLOR[s]}55` } : {}) }}
                        onClick={() => tapState(cat.id, s)}
                        aria-label={`${cat.label}: ${s}`}
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
                      value={drafts[cat.id] ?? entry.note}
                      placeholder="Add a note (optional)…"
                      onChange={e => { setDrafts(prev => ({ ...prev, [cat.id]: e.target.value })); if (noteSave.get(cat.id) === "error") noteSave.reset(cat.id); }}
                      onBlur={() => saveNote(cat.id, entry)}
                    />
                    <SaveStatus status={noteSave.get(cat.id)} onRetry={() => saveNote(cat.id, entry)} />
                  </>
                )}
                <button style={S.prioExpandBtn} onClick={() => setWalkthroughCategory(cat.id)}>Walk through this ›</button>
                {dashCat && <div style={{ marginTop: 10 }}><SphereMiniMeter weeks={dashCat.weeks} /></div>}
              </div>
            );
          })}
        </div>
      ))}
      <TapError message={tapError} />
      {historyOpen && <SphereHistoryModal onClose={() => setHistoryOpen(false)} thisWeekChecks={checks} />}
      {walkthroughCategory && (
        <SphereWalkthroughModal
          category={walkthroughCategory}
          label={SPHERE_CATEGORIES.find(c => c.id === walkthroughCategory)!.label}
          savedAnswers={byCategory.get(walkthroughCategory)?.answers ?? null}
          onClose={() => setWalkthroughCategory(null)}
          onSave={(state, answers) => saveWalkthrough(walkthroughCategory, state, answers)}
        />
      )}
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
  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  return (
    <div style={S.chatWrap}>
      <div style={{ padding: "4px 18px 0" }}>
        {/* #39: matches the "Chat" nav label — Steward is the assistant's
            name (chat bubbles already label its replies "STEWARD"), not
            this screen's own title. */}
        <h1 style={S.pageTitle}>Chat</h1>
        <div style={S.pageSub}>Your partner, bringing just the truth.</div>
        <FirstVisitTip id="chat">Talk it through with Steward — brain dump, ask for a plan, or just think out loud.</FirstVisitTip>
        <div style={S.toneRow} role="radiogroup" aria-label="Steward tone">
          {(["straight_talk", "middle_of_the_road", "take_it_easy"] as const).map(t => (
            <button key={t} style={{ ...S.toneOpt, ...(tone === t ? S.toneOptOn : {}) }} onClick={() => onSetTone(t)} role="radio" aria-checked={tone === t}>{TONE_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div ref={scrollFade.ref} style={S.chatMsgs}>
        {scrollFade.showFade && <div style={S.scrollFadeCue} />}
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
// Toggles only hide items from This Week's view (#97) — never touch the
// underlying data. Per-device, so localStorage rather than a profile field;
// wrapped in try/catch same as FirstVisitTip's own localStorage use since
// private browsing / blocked storage shouldn't break the toggle itself.
function useWeekVisibilityToggle(key: string): [boolean, () => void] {
  const storageKey = `steward:week-hide-${key}`;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  function toggle() {
    setHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* private browsing, etc. */ }
      return next;
    });
  }
  return [hidden, toggle];
}

function WeekView({ events, jobs, pursuits, calendarAccounts, onRefresh, onConnectCalendar, onDisconnectCalendar }: {
  events: Event[]; jobs: Job[]; pursuits: Pursuit[]; calendarAccounts: string[];
  onRefresh: () => Promise<void>; onConnectCalendar: () => void; onDisconnectCalendar: (email: string) => void;
}) {
  // #115 — a fixed, generous window (see calendarRange) computed once per
  // mount, not on every render; the whole scroll happens client-side over
  // this already-loaded list, no fetch-on-scroll.
  const days = useMemo(() => calendarDays(), []);
  const todayKey = ymd(new Date());
  const pursuitNameById = new Map(pursuits.map(p => [p.id, p.name]));
  const datedWork = jobs
    .map(j => jobCalendarEvent(j, (j.pursuitId !== null && pursuitNameById.get(j.pursuitId)) || ""))
    .filter((event): event is Event => Boolean(event));
  // Commitments and Google Calendar events are tagged at the source
  // (routes/steward.ts's GET /coming-up) specifically so these two toggles
  // can filter them independently — no due-date field on Priorities yet
  // (see #97), so there's no third toggle for those.
  const [hideCommitments, toggleCommitments] = useWeekVisibilityToggle("commitments");
  const [hideExternal, toggleExternal] = useWeekVisibilityToggle("external");
  const visibleEvents = events.filter(e =>
    !(hideCommitments && e.tag === "Commitment") && !(hideExternal && e.tag === "Google Calendar"));
  const calendarEvents = [...visibleEvents, ...datedWork].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const scrollFade = useBottomScrollFade<HTMLDivElement>();

  // One entry per distinct month in `days`, in order — drives both the
  // sticky header's label and the prev/next arrows' scroll targets.
  const months = useMemo(() => {
    const list: { key: string; label: string; firstDayKey: string }[] = [];
    for (const d of days) {
      if (list.length === 0 || list[list.length - 1].key !== d.monthKey) {
        list.push({ key: d.monthKey, label: d.monthLabel, firstDayKey: d.key });
      }
    }
    return list;
  }, [days]);
  const todayMonthKey = days.find(d => d.key === todayKey)?.monthKey ?? months[0]?.key ?? "";
  const [currentMonthKey, setCurrentMonthKey] = useState(todayMonthKey);
  const dayRefs = useRef(new Map<string, HTMLDivElement>());
  const headerRef = useRef<HTMLDivElement>(null);

  // Tracks which month is "current" (the last month-start row that's
  // scrolled past the sticky header), so the month label and prev/next
  // arrows stay in sync with what's actually on screen. Threshold is the
  // header's own measured height, not a fixed pixel guess — scrollToDay
  // below positions a jumped-to row's top edge exactly at that boundary,
  // so a fixed threshold smaller than the (now much taller, title+subtitle+
  // toggles) header meant a row landed there was never actually detected
  // as "passed," leaving currentMonthKey stuck on the previous month and
  // the next arrow click re-targeting the same month it just jumped to.
  useEffect(() => {
    const el = scrollFade.ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const elTop = el.getBoundingClientRect().top;
      const threshold = headerRef.current?.getBoundingClientRect().height ?? 60;
      let current = months[0]?.key ?? "";
      for (const m of months) {
        const rowEl = dayRefs.current.get(m.firstDayKey);
        if (!rowEl) continue;
        if (rowEl.getBoundingClientRect().top - elTop <= threshold) current = m.key;
        else break;
      }
      setCurrentMonthKey(current);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  // Manual offset instead of scrollIntoView: the sticky header sits inside
  // this same scroll container, so a plain scrollIntoView(block:"start")
  // lands the target row right underneath it (still hidden) rather than
  // just below it.
  function scrollToDay(key: string, behavior: ScrollBehavior = "smooth") {
    const el = scrollFade.ref.current;
    const target = dayRefs.current.get(key);
    if (!el || !target) return;
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
    const targetTop = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTo({ top: targetTop - headerHeight, behavior });
  }
  const currentMonthIndex = months.findIndex(m => m.key === currentMonthKey);
  // SIM-02 (#140) — all ~1,095 days stay mounted (see the #115 notes above
  // for why: scrollToDay/the month-tracking listener both depend on every
  // day row being a real, measurable DOM node), but only a small buffer
  // around the currently-relevant month is exposed to assistive tech. Every
  // day row outside this window gets aria-hidden, which affects only the
  // accessibility tree — it doesn't touch layout, getBoundingClientRect(),
  // or scroll behavior, so none of the #115 scroll/jump/sync mechanics
  // above are affected. This does NOT reduce render/paint cost the way true
  // virtualization would — offscreen rows are still in the DOM and painted,
  // just no longer exposed to screen readers. currentMonthIndex already
  // updates on both free-scroll (the listener above) and deliberate jumps
  // (jumpMonth/Today), so this buffer re-derives automatically either way.
  const activeMonthKeys = useMemo(() => {
    const set = new Set<string>();
    for (let i = currentMonthIndex - 1; i <= currentMonthIndex + 1; i++) {
      const m = months[i];
      if (m) set.add(m.key);
    }
    return set;
  }, [months, currentMonthIndex]);
  // Instant, not smooth: the arrows are meant to be paged through quickly,
  // and a "smooth" scrollTo fired again before the previous one finishes
  // animating is exactly the case where mobile Safari's smooth-scroll
  // implementation can stall the scroll container outright — the arrow
  // would then read as "stopped working" until a manual scroll nudged it
  // loose. An instant jump has no in-flight animation to collide with.
  //
  // setCurrentMonthKey is also called directly here, not left to the
  // scroll-listener's own pixel-geometry inference below: scrollToDay
  // lands the target row's top at exactly the listener's threshold value,
  // so a sub-pixel rounding difference between the two independently
  // -measured rects can flip that comparison either way. For a *forward*
  // jump that miss leaves the listener's "current" pinned on the old
  // month (since it accumulates in order and bails on the first miss) —
  // every next click re-targets the same month, which is exactly "the
  // arrow only ever advances one month total." A backward jump's miss is
  // harmless by comparison (it just undershoots by one extra month), which
  // is why only the forward direction ever got stuck. Since a deliberate
  // jump already knows its destination month with certainty, there's no
  // need to re-derive it from scroll position at all.
  function jumpMonth(delta: number) {
    const target = months[currentMonthIndex + delta];
    if (!target) return;
    scrollToDay(target.firstDayKey, "auto");
    setCurrentMonthKey(target.key);
  }

  // Opening the Calendar tab previously left the list scrolled to the very
  // top of the whole window (1 month back) even though the header already
  // correctly labeled the current month — jump to today's row immediately
  // on mount instead. useLayoutEffect (not useEffect) so this happens
  // before paint and there's no visible flash of the wrong month.
  useLayoutEffect(() => {
    scrollToDay(todayKey, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spins the sync icon for at least 1s so the tap always reads as an
  // action, even when the underlying refresh resolves near-instantly.
  const [syncing, setSyncing] = useState(false);
  async function handleSync() {
    setSyncing(true);
    const minSpin = new Promise(resolve => setTimeout(resolve, 1000));
    try { await Promise.all([onRefresh(), minSpin]); } finally { setSyncing(false); }
  }

  return (
    <div ref={scrollFade.ref} style={S.scroll}>
      {scrollFade.showFade && <div style={S.scrollFadeCue} />}
      <div ref={headerRef} style={S.calendarHeader}>
        <div style={S.calendarMonthBar}>
          <button style={{ ...S.calendarMonthArrow, ...(currentMonthIndex <= 0 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => jumpMonth(-1)} aria-label="Previous month">‹</button>
          <div style={S.calendarMonthLabel} aria-live="polite" aria-atomic="true">{months[currentMonthIndex]?.label ?? ""}</div>
          <button style={{ ...S.calendarMonthArrow, ...(currentMonthIndex >= months.length - 1 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => jumpMonth(1)} aria-label="Next month">›</button>
          <button style={S.calendarSyncBtn} onClick={handleSync} disabled={syncing} aria-label="Refresh calendar" title="Refresh calendar">
            <span style={{ display: "flex", animation: syncing ? "calendarSpin 0.6s linear infinite" : undefined }}>
              <Icon name="sync" size={15} color={C.parchmentMid} stroke={1.8} />
            </span>
          </button>
          <button style={S.calendarTodayBtn} onClick={() => { scrollToDay(todayKey, "auto"); setCurrentMonthKey(todayMonthKey); }} aria-label="Jump to today">Today</button>
        </div>
        <h1 style={S.pageTitle}>Calendar</h1>
        <div style={S.pageSub}>Work, commitments, and calendar events — scroll ahead or back.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...E.chip, ...(hideCommitments ? { opacity: 0.5 } : { borderColor: C.brass, color: C.brass }) }} onClick={toggleCommitments}>
            Commitments {hideCommitments ? "hidden" : "shown"}
          </button>
          <button style={{ ...E.chip, ...(hideExternal ? { opacity: 0.5 } : { borderColor: C.brass, color: C.brass }) }} onClick={toggleExternal}>
            External calendars {hideExternal ? "hidden" : "shown"}
          </button>
        </div>
        <div style={S.calendarHeaderLine} />
      </div>
      <FirstVisitTip id="week">See what's ahead — work, commitments, and calendar events together, scroll to see more.</FirstVisitTip>
      {days.map(d => {
        const items = calendarEvents.filter(e => e.date === d.key);
        const isToday = d.key === todayKey;
        const past = d.key < todayKey;
        const inBuffer = activeMonthKeys.has(d.monthKey);
        return (
          <div
            key={d.key}
            ref={el => { if (el) dayRefs.current.set(d.key, el); else dayRefs.current.delete(d.key); }}
            style={{ ...S.weekRow, ...(isToday ? S.weekToday : {}), ...(past ? { opacity: 0.3 } : {}) }}
            aria-hidden={inBuffer ? undefined : true}
          >
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
// #91 follow-up (job/pursuit redesign) — the very first question when
// adding a job is now "what's this for," not "which pursuit": the
// business-vs-employee split lives here now, not on the pursuit itself
// (PursuitModal dropped its own version of this branching — see there).
// Three forks:
//   "own"   — something you run (Business or Side Hustle): unchanged
//             5-question job wizard, pursuit list/creation narrowed to
//             those two categories.
//   "myjob" — a job you don't own: pursuit-level fields (reports-to,
//             career goal) are asked once, at pursuit-creation time, not
//             per job; auto-selects your existing "Job" pursuit when
//             there's exactly one, so the common case has zero extra taps.
//             Individual jobs here (routine task or a growth project like
//             a degree or promotion push — same shape either way, no
//             sub-fork) are lightweight: name + due date + notes.
//   "else"  — Volunteer/Hobby/Other: today's original plain picker,
//             unfiltered, no special follow-up fields.
type JobFlowStep = "fork" | "a_pick" | "a_new" | "a_wizard" | "b_create" | "b_pick" | "b_form" | "c_pick" | "c_new" | "c_wizard";

function JobModal({ pursuits, onClose, onCreated, onPursuitCreated }: {
  pursuits: Pursuit[]; onClose: () => void; onCreated: () => void; onPursuitCreated: () => void;
}) {
  const Qs = [
    { q: "What's the job?", ph: "e.g. First Baptist — monument sign", key: "name" },
    { q: "When does it need to be done?", ph: "e.g. June 20, end of month", key: "due" },
    { q: "Materials needed?", ph: "e.g. 4×8 aluminum, vinyl", key: "materials" },
    { q: "Rough budget or quote?", ph: "e.g. $2,400 or not sure", key: "budget" },
    { q: "Anything that could slow you down?", ph: "e.g. approval, weather", key: "risk" },
  ];

  const ownablePursuits = pursuits.filter(p => p.category === "business" || p.category === "side_hustle");
  const jobPursuits = pursuits.filter(p => p.category === "job");

  const [flowStep, setFlowStep] = useState<JobFlowStep>("fork");
  const [pursuitId, setPursuitId] = useState<number | null>(null);
  const [selectedPursuitName, setSelectedPursuitName] = useState<string | null>(null);

  function selectFork(fork: "own" | "myjob" | "else") {
    if (fork === "own") { setFlowStep("a_pick"); return; }
    if (fork === "else") { setFlowStep("c_pick"); return; }
    if (jobPursuits.length === 0) { setFlowStep("b_create"); return; }
    if (jobPursuits.length === 1) {
      setPursuitId(jobPursuits[0].id);
      setSelectedPursuitName(jobPursuits[0].name);
      setFlowStep("b_form");
      return;
    }
    setFlowStep("b_pick");
  }

  // ── "Something I own" — new-pursuit fields (Business/Side Hustle only) ──
  const [newPursuitName, setNewPursuitName] = useState("");
  const [newPursuitCategory, setNewPursuitCategory] = useState<PursuitCategory>("business");
  const [newPursuitNotes, setNewPursuitNotes] = useState("");
  const [bizTeamOrGoal, setBizTeamOrGoal] = useState("");
  const [bizDuration, setBizDuration] = useState("");
  const [creatingErr, setCreatingErr] = useState("");
  const [creating, setCreating] = useState(false);

  function combinedOwnedNotes(): string {
    const parts = [newPursuitNotes.trim()];
    if (newPursuitCategory === "business") {
      if (bizTeamOrGoal.trim()) parts.push(`Team size / revenue goal: ${bizTeamOrGoal.trim()}`);
      if (bizDuration.trim()) parts.push(`Running for: ${bizDuration.trim()}`);
    }
    return parts.filter(Boolean).join(" — ");
  }

  async function createOwnedPursuitAndContinue() {
    if (!newPursuitName.trim()) { setCreatingErr("Name is required."); return; }
    setCreatingErr("");
    setCreating(true);
    try {
      const r = await apiFetch(`${API}/pursuits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPursuitName.trim(), category: newPursuitCategory, notes: combinedOwnedNotes() }),
      });
      if (r.ok) {
        const created = await r.json() as Pursuit;
        onPursuitCreated();
        setPursuitId(created.id);
        setFlowStep("a_wizard");
      } else {
        setCreatingErr("Couldn't create the pursuit. Try again.");
      }
    } catch {
      setCreatingErr("Couldn't reach the server.");
    } finally {
      setCreating(false);
    }
  }

  // ── "Something else" — new-pursuit fields (Volunteer/Hobby/Other, plain) ──
  const [elsePursuitName, setElsePursuitName] = useState("");
  const [elsePursuitCategory, setElsePursuitCategory] = useState<PursuitCategory>("volunteer");
  const [elsePursuitNotes, setElsePursuitNotes] = useState("");
  const [elseCreatingErr, setElseCreatingErr] = useState("");
  const [elseCreating, setElseCreating] = useState(false);

  async function createElsePursuitAndContinue() {
    if (!elsePursuitName.trim()) { setElseCreatingErr("Name is required."); return; }
    setElseCreatingErr("");
    setElseCreating(true);
    try {
      const r = await apiFetch(`${API}/pursuits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: elsePursuitName.trim(), category: elsePursuitCategory, notes: elsePursuitNotes.trim() }),
      });
      if (r.ok) {
        const created = await r.json() as Pursuit;
        onPursuitCreated();
        setPursuitId(created.id);
        setFlowStep("c_wizard");
      } else {
        setElseCreatingErr("Couldn't create the pursuit. Try again.");
      }
    } catch {
      setElseCreatingErr("Couldn't reach the server.");
    } finally {
      setElseCreating(false);
    }
  }

  // ── "My job" — pursuit-level fields, asked once ──
  const [myJobPursuitName, setMyJobPursuitName] = useState("");
  const [myJobReportsTo, setMyJobReportsTo] = useState("");
  const [myJobGoal, setMyJobGoal] = useState("");
  const [myJobErr, setMyJobErr] = useState("");
  const [myJobCreating, setMyJobCreating] = useState(false);

  async function createMyJobPursuitAndContinue() {
    if (!myJobPursuitName.trim()) { setMyJobErr("Name is required."); return; }
    setMyJobErr("");
    setMyJobCreating(true);
    try {
      const parts = [];
      if (myJobReportsTo.trim()) parts.push(`Reports to: ${myJobReportsTo.trim()}`);
      if (myJobGoal.trim()) parts.push(`Career goal: ${myJobGoal.trim()}`);
      const r = await apiFetch(`${API}/pursuits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: myJobPursuitName.trim(), category: "job", notes: parts.join(" — ") }),
      });
      if (r.ok) {
        const created = await r.json() as Pursuit;
        onPursuitCreated();
        setPursuitId(created.id);
        setSelectedPursuitName(created.name);
        setFlowStep("b_form");
      } else {
        setMyJobErr("Couldn't create the pursuit. Try again.");
      }
    } catch {
      setMyJobErr("Couldn't reach the server.");
    } finally {
      setMyJobCreating(false);
    }
  }

  function pickJobPursuit(p: Pursuit) {
    setPursuitId(p.id);
    setSelectedPursuitName(p.name);
    setFlowStep("b_form");
  }

  // ── "My job" — the lightweight job form itself ──
  const [empJobName, setEmpJobName] = useState("");
  const [empJobDue, setEmpJobDue] = useState("");
  const [empJobNotes, setEmpJobNotes] = useState("");
  const [empNameErr, setEmpNameErr] = useState("");
  const empSaveStatus = useSaveStatus();

  async function submitEmployeeJob() {
    if (!empJobName.trim()) { setEmpNameErr("Give this job a name to continue."); return; }
    setEmpNameErr("");
    await empSaveStatus.save(async () => {
      const r = await apiFetch(`${API}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: empJobName.trim(), due: empJobDue.trim(), stage: "New", pct: 0, pursuitId,
          materials: "", budget: "", risk: "", notes: empJobNotes.trim(),
        }),
      });
      if (r.ok) { onCreated(); onClose(); return true; }
      return false;
    });
  }

  // ── "Something I own" / "Something else" — the shared 5-question job wizard ──
  // wizardStep runs 0..Qs.length-1 for the stepped questions, and
  // Qs.length for the final editable review/summary screen (SIM-05) —
  // mirrors SphereWalkthroughModal's `atSummary` pattern (step >= questions.length).
  const [wizardStep, setWizardStep] = useState(0);
  const [val, setVal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wizardNameErr, setWizardNameErr] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const wizardSaveStatus = useSaveStatus();
  const atWizardSummary = wizardStep >= Qs.length;
  const q = atWizardSummary ? null : Qs[wizardStep];
  const isNameStep = q?.key === "name";

  async function submitWizardJob(final: Record<string, string>) {
    await wizardSaveStatus.save(async () => {
      const r = await apiFetch(`${API}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: final.name, due: final.due || "", stage: "New", pct: 0, pursuitId,
          materials: final.materials || "", budget: final.budget || "", risk: final.risk || "",
        }),
      });
      if (r.ok) { onCreated(); onClose(); return true; }
      return false;
    });
  }
  // Jumps to any wizard step — used by Back and by the summary screen's
  // per-field Edit links (SIM-05) — and syncs `val` to whatever was already
  // answered for that step, so re-visiting a question shows the prior
  // answer instead of a blank field.
  function goToWizardStep(step: number) {
    setWizardNameErr("");
    setWizardStep(step);
    setVal(answers[Qs[step].key] ?? "");
  }
  function advanceWizard(answer: string) {
    const step = Qs[wizardStep];
    const trimmed = answer.trim();
    if (step.key === "name" && !trimmed) { setWizardNameErr("Give this job a name to continue."); return; }
    setWizardNameErr("");
    const next = { ...answers, [step.key]: trimmed };
    setAnswers(next);
    if (wizardStep < Qs.length - 1) {
      const nextStep = wizardStep + 1;
      setWizardStep(nextStep);
      setVal(next[Qs[nextStep].key] ?? "");
    } else {
      // Last question answered — land on the review/summary screen instead
      // of submitting immediately, so every answer (name included) stays
      // editable one more time before it's actually saved.
      setWizardStep(Qs.length);
      setVal("");
    }
  }
  // Quick-add (SIM-05, optional stretch goal): all 5 fields on one flat
  // screen for experienced users, reachable from the wizard's first
  // screen. Shares the same `answers`/submitWizardJob plumbing as the
  // stepped path, so it can't create a second way to save a blank name.
  function updateQuickAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
    if (key === "name" && wizardNameErr) setWizardNameErr("");
  }
  function submitQuickAdd() {
    const name = (answers.name ?? "").trim();
    if (!name) { setWizardNameErr("Give this job a name to continue."); return; }
    setWizardNameErr("");
    submitWizardJob({
      name,
      due: (answers.due ?? "").trim(),
      materials: (answers.materials ?? "").trim(),
      budget: (answers.budget ?? "").trim(),
      risk: (answers.risk ?? "").trim(),
    });
  }

  if (flowStep === "fork") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" onClose={onClose}>
          <div style={M.q}>What's this job for?</div>
          <button style={{ ...M.choice, display: "block", width: "100%", textAlign: "left", marginBottom: 10 }} onClick={() => selectFork("own")}>
            <strong>Something I own</strong>
            <div style={S.prioSub}>A business or side hustle you run</div>
          </button>
          <button style={{ ...M.choice, display: "block", width: "100%", textAlign: "left", marginBottom: 10 }} onClick={() => selectFork("myjob")}>
            <strong>My job</strong>
            <div style={S.prioSub}>Work for an employer</div>
          </button>
          <button style={{ ...M.choice, display: "block", width: "100%", textAlign: "left", marginBottom: 10 }} onClick={() => selectFork("else")}>
            <strong>Something else</strong>
            <div style={S.prioSub}>Volunteer work, a hobby, anything else</div>
          </button>
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "a_new") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Pursuit" onClose={onClose}>
          <div style={E.fieldGroup}>
            <div style={E.label}>Name</div>
            <input style={M.input} value={newPursuitName} onChange={e => setNewPursuitName(e.target.value)} placeholder="e.g. Signs, Etsy shop" autoFocus />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Category</div>
            <div style={E.chipRow}>
              {OWNABLE_PURSUIT_CATEGORIES.map(c => (
                <button key={c} style={{ ...E.chip, ...(newPursuitCategory === c ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setNewPursuitCategory(c)}>{PURSUIT_CATEGORY_LABEL[c]}</button>
              ))}
            </div>
          </div>
          {newPursuitCategory === "business" && (
            <>
              <div style={E.fieldGroup}>
                <div style={E.label}>Team size / revenue goal (optional)</div>
                <input style={M.input} value={bizTeamOrGoal} onChange={e => setBizTeamOrGoal(e.target.value)} placeholder="e.g. solo, 3 employees, $500k goal" />
              </div>
              <div style={E.fieldGroup}>
                <div style={E.label}>How long running (optional)</div>
                <input style={M.input} value={bizDuration} onChange={e => setBizDuration(e.target.value)} placeholder="e.g. 2 years" />
              </div>
            </>
          )}
          <div style={E.fieldGroup}>
            <div style={E.label}>Notes</div>
            <input style={M.input} value={newPursuitNotes} onChange={e => setNewPursuitNotes(e.target.value)} placeholder="Optional" />
          </div>
          <TapError message={creatingErr || null} />
          <button style={M.next} disabled={creating} onClick={createOwnedPursuitAndContinue}>{creating ? "Creating…" : "Continue →"}</button>
          <button style={M.cancel} onClick={() => setFlowStep("a_pick")}>Back</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "a_pick") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" onClose={onClose}>
          <div style={M.q}>Which pursuit is this for?</div>
          <div style={E.chipRow}>
            {ownablePursuits.map(p => (
              <button key={p.id} style={E.chip} onClick={() => { setPursuitId(p.id); setSelectedPursuitName(p.name); setFlowStep("a_wizard"); }}>{p.name}</button>
            ))}
          </div>
          <button style={M.cancel} onClick={() => setFlowStep("a_new")}>＋ New pursuit</button>
          <button style={M.cancel} onClick={() => { setPursuitId(null); setSelectedPursuitName(null); setFlowStep("a_wizard"); }}>Skip — not tied to a pursuit</button>
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "b_create") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="My Job" onClose={onClose}>
          <div style={M.q}>Let's set up your job.</div>
          <div style={{ ...S.prioSub, marginTop: -14, marginBottom: 16 }}>Asked once — you won't see this again once it exists.</div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Name</div>
            <input style={M.input} value={myJobPursuitName} onChange={e => setMyJobPursuitName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Who you report to (optional)</div>
            <input style={M.input} value={myJobReportsTo} onChange={e => setMyJobReportsTo(e.target.value)} placeholder="e.g. store manager, regional director" />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Career goal (optional)</div>
            <input style={M.input} value={myJobGoal} onChange={e => setMyJobGoal(e.target.value)} placeholder="e.g. promotion to team lead" />
          </div>
          <TapError message={myJobErr || null} />
          <button style={M.next} disabled={myJobCreating} onClick={createMyJobPursuitAndContinue}>{myJobCreating ? "Creating…" : "Continue →"}</button>
          <button style={M.cancel} onClick={() => setFlowStep("fork")}>Back</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "b_pick") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" onClose={onClose}>
          <div style={M.q}>Which job is this for?</div>
          <div style={E.chipRow}>
            {jobPursuits.map(p => (
              <button key={p.id} style={E.chip} onClick={() => pickJobPursuit(p)}>{p.name}</button>
            ))}
          </div>
          <button style={M.cancel} onClick={() => setFlowStep("fork")}>Back</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "b_form") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" headExtra={selectedPursuitName ? <div style={S.prioSub}>{selectedPursuitName}</div> : undefined} onClose={onClose}>
          <div style={E.fieldGroup}>
            <div style={E.label}>Name</div>
            <input style={M.input} value={empJobName} onChange={e => { setEmpJobName(e.target.value); if (empNameErr) setEmpNameErr(""); }} placeholder="e.g. Finish Q3 report, or: Finish AWS certification" autoFocus />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Due date (optional)</div>
            <input style={M.input} value={empJobDue} onChange={e => setEmpJobDue(e.target.value)} placeholder="e.g. Nov 15" />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Notes</div>
            <input style={M.input} value={empJobNotes} onChange={e => setEmpJobNotes(e.target.value)} placeholder="Optional" />
          </div>
          <TapError message={empNameErr || null} />
          <button style={M.next} disabled={empSaveStatus.status === "saving" || !empJobName.trim()} onClick={submitEmployeeJob}>{empSaveStatus.status === "saving" ? "Saving…" : "Add Job ✓"}</button>
          <SaveStatus status={empSaveStatus.status} onRetry={submitEmployeeJob} />
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "c_new") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Pursuit" onClose={onClose}>
          <div style={E.fieldGroup}>
            <div style={E.label}>Name</div>
            <input style={M.input} value={elsePursuitName} onChange={e => setElsePursuitName(e.target.value)} placeholder="e.g. Church volunteering, Guitar" autoFocus />
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Category</div>
            <div style={E.chipRow}>
              {OTHER_PURSUIT_CATEGORIES.map(c => (
                <button key={c} style={{ ...E.chip, ...(elsePursuitCategory === c ? { borderColor: C.brass, color: C.brass } : {}) }} onClick={() => setElsePursuitCategory(c)}>{PURSUIT_CATEGORY_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <div style={E.fieldGroup}>
            <div style={E.label}>Notes</div>
            <input style={M.input} value={elsePursuitNotes} onChange={e => setElsePursuitNotes(e.target.value)} placeholder="Optional" />
          </div>
          <TapError message={elseCreatingErr || null} />
          <button style={M.next} disabled={elseCreating} onClick={createElsePursuitAndContinue}>{elseCreating ? "Creating…" : "Continue →"}</button>
          <button style={M.cancel} onClick={() => setFlowStep("c_pick")}>Back</button>
        </ModalSheet>
      </div>
    );
  }

  if (flowStep === "c_pick") {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" onClose={onClose}>
          <div style={M.q}>Which pursuit is this for?</div>
          <div style={E.chipRow}>
            {pursuits.map(p => (
              <button key={p.id} style={E.chip} onClick={() => { setPursuitId(p.id); setSelectedPursuitName(p.name); setFlowStep("c_wizard"); }}>{p.name}</button>
            ))}
          </div>
          <button style={M.cancel} onClick={() => setFlowStep("c_new")}>＋ New pursuit</button>
          <button style={M.cancel} onClick={() => { setPursuitId(null); setSelectedPursuitName(null); setFlowStep("c_wizard"); }}>Skip — not tied to a pursuit</button>
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  // flowStep === "a_wizard" || "c_wizard" — the shared 5-question wizard
  // (SIM-05: Back + a final editable review screen, plus an optional
  // quick-add flat form — adapted from SphereWalkthroughModal's
  // step/atSummary/nav idiom, using JobModal's own M.* styles).
  if (quickAdd) {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" headExtra={<div style={S.prioSub}>Quick add</div>} onClose={onClose}>
          <div style={M.q}>Add everything at once</div>
          {Qs.map(qq => (
            <div key={qq.key} style={E.fieldGroup}>
              <div style={E.label}>{qq.q}{qq.key === "name" ? "" : " (optional)"}</div>
              <input
                style={M.input}
                value={answers[qq.key] ?? ""}
                onChange={e => updateQuickAnswer(qq.key, e.target.value)}
                placeholder={qq.ph}
                autoFocus={qq.key === "name"}
              />
            </div>
          ))}
          <TapError message={wizardNameErr || null} />
          <button style={M.next} disabled={wizardSaveStatus.status === "saving"} onClick={submitQuickAdd}>{wizardSaveStatus.status === "saving" ? "Saving…" : "Add Job ✓"}</button>
          <SaveStatus status={wizardSaveStatus.status} onRetry={submitQuickAdd} />
          <button style={M.cancel} onClick={() => { setQuickAdd(false); setWizardNameErr(""); }}>‹ Back to guided questions</button>
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  if (atWizardSummary) {
    return (
      <div style={M.overlay}>
        <ModalSheet title="New Job" headExtra={<div style={S.prioSub}>Review</div>} onClose={onClose}>
          <div style={M.q}>Review before adding</div>
          <div style={M.summaryBox}>
            {Qs.map((qq, i) => (
              <div key={qq.key} style={M.summaryRow}>
                <div>
                  <div style={M.summaryLabel}>{qq.q}</div>
                  <div style={M.summaryValue}>{answers[qq.key]?.trim() ? answers[qq.key] : <span style={{ color: C.parchmentLow }}>—</span>}</div>
                </div>
                <button style={M.summaryEdit} onClick={() => goToWizardStep(i)}>Edit</button>
              </div>
            ))}
          </div>
          <TapError message={wizardNameErr || null} />
          <button style={M.next} disabled={wizardSaveStatus.status === "saving" || !(answers.name ?? "").trim()} onClick={() => submitWizardJob(answers)}>{wizardSaveStatus.status === "saving" ? "Saving…" : "Add Job ✓"}</button>
          <SaveStatus status={wizardSaveStatus.status} onRetry={() => submitWizardJob(answers)} />
          <button style={M.cancel} onClick={onClose}>Cancel</button>
        </ModalSheet>
      </div>
    );
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="New Job" headExtra={<div style={S.prioSub}>{wizardStep + 1} / {Qs.length}</div>} onClose={onClose}>
        <div style={M.track}><div style={{ ...M.fill, width: ((wizardStep + 1) / Qs.length * 100) + "%" }} /></div>
        <div style={M.q}>{q!.q}</div>
        <>
          <input style={M.input} value={val} onChange={e => { setVal(e.target.value); if (wizardNameErr) setWizardNameErr(""); }} onKeyDown={e => e.key === "Enter" && advanceWizard(val)} placeholder={q!.ph} autoFocus />
          <TapError message={isNameStep ? (wizardNameErr || null) : null} />
          <div style={M.wizNav}>
            <button style={{ ...M.wizBack, ...(wizardStep === 0 ? { opacity: 0.3, pointerEvents: "none" } : {}) }} onClick={() => goToWizardStep(wizardStep - 1)}>‹ Back</button>
            <button style={{ ...M.wizNext, ...(wizardSaveStatus.status === "saving" || (isNameStep && !val.trim()) ? { opacity: 0.4 } : {}) }} disabled={wizardSaveStatus.status === "saving" || (isNameStep && !val.trim())} onClick={() => advanceWizard(val)}>
              {wizardStep < Qs.length - 1 ? "Next →" : "Review →"}
            </button>
          </div>
          {wizardStep === 0 && <button style={{ ...M.cancel, marginTop: 4 }} onClick={() => setQuickAdd(true)}>Or fill in all fields at once →</button>}
        </>
        <SaveStatus status={wizardSaveStatus.status} onRetry={() => submitWizardJob(answers)} />
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
  const [notes, setNotes] = useState(job.notes);
  const saveStatus = useSaveStatus();
  const [validationErr, setValidationErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function save() {
    if (!name.trim()) { setValidationErr("Name is required."); return; }
    setValidationErr("");
    await saveStatus.save(async () => {
      const r = await apiFetch(`${API}/jobs/${job.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pursuitId, stage: stage.trim(), due: due.trim(), pct, materials: materials.trim(), budget: budget.trim(), risk: risk.trim(), notes: notes.trim() }),
      });
      if (r.ok) { onSaved(pursuitId); onClose(); return true; }
      return false;
    });
  }

  // Soft — reversible from the Deleted Jobs list (#89). One "Delete" action
  // here, no confirm needed, same as relationships' main edit view — the
  // separate, genuinely-permanent delete only lives inside the Deleted Jobs
  // list itself (JobsDeletedModal), matching PeopleDeletedModal's pattern.
  // (An earlier version of this put both a reversible "Close" and a
  // permanent "Delete" side by side here, which was confusing enough that
  // someone used the wrong one and lost a job for good — hence the change.)
  async function del() {
    setDeleting(true);
    try {
      const r = await apiFetch(`${API}/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
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
        <div style={E.fieldGroup}>
          <div style={E.label}>Notes</div>
          <input style={M.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
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

// Deleted-jobs history view (#89) — mirrors PursuitsClosedModal: a Reopen
// action only, since "Delete permanently" in JobEditModal already covers
// permanent removal, gated behind its own inline confirm — mirroring
// PeopleDeletedModal exactly, since "Delete Job" in JobEditModal is now
// just the soft/reversible action (see its comment for why that changed).
function JobsDeletedModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [deleted, setDeleted] = useState<Job[] | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [confirmPermanentId, setConfirmPermanentId] = useState<number | null>(null);
  const rowError = useKeyedTapError<number>();
  const scrollFade = useBottomScrollFade<HTMLDivElement>();

  const load = useCallback(() => {
    apiFetch(`${API}/jobs/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reopen(id: number) {
    setBusyIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
      if (r.ok) {
        setDeleted(prev => prev ? prev.filter(j => j.id !== id) : prev);
        onChanged();
        return;
      }
    } catch { /* fall through */ }
    setBusyIds(prev => prev.filter(item => item !== id));
    rowError.flash(id, "Couldn't reopen — try again");
  }

  async function permanentlyDelete(id: number) {
    setBusyIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/jobs/${id}`, { method: "DELETE" });
      if (r.ok) {
        setDeleted(prev => prev ? prev.filter(j => j.id !== id) : prev);
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
      <ModalSheet title="Deleted Jobs" onClose={onClose}>
        <div ref={scrollFade.ref} style={S.scrollCap5}>
          {scrollFade.showFade && <div style={S.scrollFadeCue} />}
          {(deleted ?? []).map(j => (
            <div key={j.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.prioTitle}>{j.name}</div>
                  <div style={S.prioSub}>{[j.stage, j.due].filter(Boolean).join("  •  ") || "No stage or due date"}</div>
                </div>
                <button style={S.prioLogLink} disabled={busyIds.includes(j.id)} onClick={() => reopen(j.id)}>
                  {busyIds.includes(j.id) ? "Reopening…" : "Reopen"}
                </button>
              </div>
              {confirmPermanentId === j.id ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ ...S.prioSub, color: "#C87060", marginBottom: 6 }}>
                    Permanently delete {j.name}? This can't be undone.
                  </div>
                  <button style={{ ...S.prioLogLink, color: "#C87060" }} disabled={busyIds.includes(j.id)} onClick={() => permanentlyDelete(j.id)}>
                    {busyIds.includes(j.id) ? "Deleting…" : "Yes, permanently delete"}
                  </button>
                  <button style={{ ...S.prioLogLink, marginLeft: 12 }} disabled={busyIds.includes(j.id)} onClick={() => setConfirmPermanentId(null)}>Cancel</button>
                </div>
              ) : (
                <button style={{ ...S.prioLogLink, color: "#C87060", marginTop: 4 }} onClick={() => setConfirmPermanentId(j.id)}>Delete permanently</button>
              )}
              <TapError message={rowError.get(j.id)} />
            </div>
          ))}
          {deleted && deleted.length === 0 && <div style={S.empty}>Nothing deleted yet.</div>}
        </div>
        <button style={M.cancel} onClick={onClose}>Close</button>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeErr, setCloseErr] = useState("");

  async function save() {
    if (!name.trim()) { setValidationErr("Name is required."); return; }
    setValidationErr("");
    const body = { name: name.trim(), category, notes: notes.trim() };
    await saveStatus.save(async () => {
      const r = pursuit
        ? await apiFetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await apiFetch(`${API}/pursuits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { onSaved(); onClose(); return true; }
      return false;
    });
  }

  async function del() {
    if (!pursuit) return;
    setDeleting(true);
    try {
      const r = await apiFetch(`${API}/pursuits/${pursuit.id}`, { method: "DELETE" });
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
      const r = await apiFetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
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
        {pursuit && (confirmDelete ? (
          <div style={{ ...S.prioSub, marginTop: 4 }}>
            Permanently delete this pursuit? This can't be undone.
            <button style={{ ...S.prioLogLink, color: "#C87060", marginLeft: 8 }} disabled={deleting} onClick={del}>{deleting ? "Deleting…" : "Yes, permanently delete"}</button>
            <button style={{ ...S.prioLogLink, marginLeft: 12 }} disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button style={{ ...M.cancel, color: "#C87060" }} onClick={() => setConfirmDelete(true)}>Delete permanently</button>
        ))}
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
  const scrollFade = useBottomScrollFade<HTMLDivElement>();

  const load = useCallback(() => {
    apiFetch(`${API}/pursuits/deleted`).then(r => r.ok ? r.json() : null).then(d => setClosed(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reopen(id: number) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/pursuits/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }) });
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
        <div ref={scrollFade.ref} style={S.scrollCap5}>
          {scrollFade.showFade && <div style={S.scrollFadeCue} />}
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
      const r = await apiFetch(`${API}/pursuits/${pursuit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
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
    apiFetch(`${API}/tasks/${task.id}/history?today=${ymd(new Date())}`)
      .then(r => r.ok ? r.json() : null)
      .then(setHistory);
  }, [task.id]);
  useEffect(() => { load(); }, [load]);

  async function saveRecurrence() {
    await recurrenceSave.save(async () => {
      const r = await apiFetch(`${API}/tasks/${task.id}`, {
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
      const r = await apiFetch(`${API}/tasks/${task.id}`, {
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
      const r = await apiFetch(`${API}/tasks/${task.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: ymd(new Date()) }),
      });
      if (r.ok) { onChanged(); load(); return; }
    } catch { /* fall through */ }
    flashActionError("Couldn't save — try again");
  }
  async function del() {
    setDeleting(true);
    try {
      const r = await apiFetch(`${API}/tasks/${task.id}`, { method: "DELETE" });
      if (r.ok) { onChanged(); onClose(); return; }
    } catch { /* fall through */ }
    setDeleting(false);
    flashActionError("Couldn't delete — try again");
  }
  async function setStatusValue(next: "open" | "stuck" | "done") {
    if (next === "done") {
      try {
        const r = await apiFetch(`${API}/tasks/${task.id}`, {
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
      const r = await apiFetch(`${API}/tasks/${task.id}`, {
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
      const r = await apiFetch(`${API}/tasks/${task.id}`, {
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
  const completedFade = useBottomScrollFade<HTMLDivElement>();
  const deletedFade = useBottomScrollFade<HTMLDivElement>();

  const load = useCallback(() => {
    apiFetch(`${API}/tasks/completed`).then(r => r.ok ? r.json() : null).then(setData);
    apiFetch(`${API}/tasks/deleted`).then(r => r.ok ? r.json() : null).then(d => setDeleted(d?.items ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Shared by both lists — "done: false" reopens a completed priority,
  // "deleted: false" restores a deleted one back to the open list.
  async function reopen(id: number, body: { done: boolean } | { deleted: boolean }) {
    setReopeningIds(prev => [...prev, id]);
    try {
      const r = await apiFetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
        <div ref={completedFade.ref} style={S.scrollCap5}>
          {completedFade.showFade && <div style={S.scrollFadeCue} />}
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
        <div ref={deletedFade.ref} style={S.scrollCap5}>
          {deletedFade.showFade && <div style={S.scrollFadeCue} />}
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
      const r = await apiFetch(`${API}/journal`, {
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
          {entries && entries.length === 0 && <div style={S.empty}>No journal entries yet. Write today's reflection from the Today tab and it'll show up here.</div>}
        </div>
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

interface IntentionHistoryEntry { date: string; commitText: string; }

// Marriage Intention's own History (#94) — separate from Journal History
// above (that one edits raw daily reflect/intention rows; this one is a
// read-mostly log of every date the intention actually changed, since it
// only ever writes a new row on a real change, plus the Select-mode
// multi-transfer into Tribe Commitments). Capped server-side at 6 months.
function IntentionHistoryModal({ relationships, onClose, onCommitSaved, onRelationshipAdded }: {
  relationships: Relationship[]; onClose: () => void; onCommitSaved: () => void; onRelationshipAdded: () => void;
}) {
  const [entries, setEntries] = useState<IntentionHistoryEntry[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [transferQueue, setTransferQueue] = useState<IntentionHistoryEntry[] | null>(null);
  const scrollFade = useBottomScrollFade<HTMLDivElement>();
  const hasSpouseRel = relationships.some(r => r.category === "spouse");
  const hasChildRel = relationships.some(r => r.category === "child");
  const historyTitle = hasSpouseRel ? "Marriage Intention History" : hasChildRel ? "Parenting Intention History" : "Friendship Intention History";

  useEffect(() => {
    getJson(`${API}/journal/intention-history`, null).then(d => {
      setEntries(isRecord(d) && Array.isArray(d.items) ? d.items as IntentionHistoryEntry[] : []);
    });
  }, []);

  function toggleSelected(date: string) {
    setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedDates([]);
  }
  function startTransfer() {
    if (!entries || selectedDates.length === 0) return;
    setTransferQueue(entries.filter(e => selectedDates.includes(e.date)));
  }
  function finishTransfer() {
    setTransferQueue(null);
    exitSelectMode();
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title={historyTitle} onClose={onClose}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button style={S.prioLogLink} onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
            {selectMode ? "Cancel select" : "Select"}
          </button>
        </div>
        <div ref={scrollFade.ref} style={S.scrollCap5}>
          {scrollFade.showFade && <div style={S.scrollFadeCue} />}
          {(entries ?? []).map(entry => (
            <div key={entry.date} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedDates.includes(entry.date)}
                  onChange={() => toggleSelected(entry.date)}
                  style={{ marginTop: 4 }}
                  aria-label={`Select intention from ${entry.date}`}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={S.prioSub}>{entry.date}</div>
                <div style={S.prioTitle}>{entry.commitText}</div>
              </div>
            </div>
          ))}
          {entries && entries.length === 0 && <div style={S.empty}>Nothing here yet — change today's intention on the Today tab and it'll show up here.</div>}
        </div>
        {selectMode && (
          <button style={{ ...M.next, ...(selectedDates.length === 0 ? { opacity: 0.4, pointerEvents: "none" } : {}) }} onClick={startTransfer}>
            Transfer{selectedDates.length > 0 ? ` ${selectedDates.length}` : ""} to Commitments
          </button>
        )}
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
      {transferQueue && (
        <IntentionTransferModal
          queue={transferQueue}
          relationships={relationships}
          onDone={finishTransfer}
          onCommitSaved={onCommitSaved}
          onRelationshipAdded={onRelationshipAdded}
        />
      )}
    </div>
  );
}

// Steps through one pre-filled Log a Commitment modal per selected
// intention (#94) — closing (whether by a successful save, which
// auto-closes, or an explicit Cancel) always advances to the next one, so
// you can edit, skip, or bail on any of them along the way without losing
// your place in the rest of the queue.
function IntentionTransferModal({ queue, relationships, onDone, onCommitSaved, onRelationshipAdded }: {
  queue: IntentionHistoryEntry[]; relationships: Relationship[];
  onDone: () => void; onCommitSaved: () => void; onRelationshipAdded: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = queue[index];
  if (!current) { onDone(); return null; }

  // Not perfectly race-free: if the very first item creates a brand-new
  // Spouse relationship, a same-session later item could still render
  // before that refetch lands and offer "add new" again rather than
  // finding it. Rare (only hits a multi-select transfer with zero
  // existing Spouse relationship), and self-corrects on the next open.
  const spouse = relationships.find(r => r.category === "spouse");

  function advance() {
    if (index + 1 >= queue.length) onDone();
    else setIndex(i => i + 1);
  }

  return (
    <CommitLogModal
      relationships={relationships}
      lockedPerson={spouse ? { id: spouse.id, label: relationshipLabel(spouse) } : undefined}
      defaultNewCategory={spouse ? undefined : "spouse"}
      initialText={current.commitText}
      onClose={advance}
      onSaved={onCommitSaved}
      onRelationshipAdded={onRelationshipAdded}
    />
  );
}

// #77 — last 5 days (today included), recomputed live by the server rather
// than logged; see lib/verses.ts's getVerseHistoryForUser. #96 adds a
// separate "My Verses" section below it — not date-based, a straight list
// of the user's own saved verses with Edit/Delete.
function VerseHistoryModal({ onClose, onToggleFavorite }: { onClose: () => void; onToggleFavorite: (ref: string, favorite: boolean, customId?: number) => Promise<boolean> }) {
  const [entries, setEntries] = useState<VerseHistoryEntry[] | null>(null);
  const [togglingRef, setTogglingRef] = useState<string | null>(null);

  const { error: toggleError, flash: flashToggleError } = useTapError();

  useEffect(() => { getList<VerseHistoryEntry>(`${API}/verse/history`).then(setEntries); }, []);

  async function toggle(entry: VerseHistoryEntry) {
    if (togglingRef) return;
    setTogglingRef(entry.ref);
    const ok = await onToggleFavorite(entry.ref, !entry.favorited, entry.custom ? entry.id : undefined);
    if (ok) setEntries(list => list && list.map(e => (e.ref === entry.ref ? { ...e, favorited: !entry.favorited } : e)));
    else flashToggleError("Couldn't save — try again");
    setTogglingRef(null);
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Verse History" onClose={onClose}>
        <div>
          {(entries ?? []).map(entry => (
            <div key={entry.date} style={S.card}>
              <div style={S.prioHeadRow}>
                <div style={S.prioSub}>{entry.date}</div>
                <button
                  style={S.verseStarBtn} onClick={() => toggle(entry)} disabled={togglingRef === entry.ref}
                  aria-label={entry.favorited ? "Remove from favorites" : "Add to favorites"} aria-pressed={entry.favorited}
                >
                  <span style={{ color: entry.favorited ? C.brass : C.parchmentDim }}>★</span>
                </button>
              </div>
              <div style={{ ...S.prioTitle, marginTop: 6 }}>{entry.text}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={S.verseRef}>{entry.ref.toUpperCase()}</div>
                {entry.custom && <span style={{ ...S.upTag, ...S.myVerseTag }}>MY VERSE</span>}
              </div>
            </div>
          ))}
          {entries && entries.length === 0 && <div style={S.empty}>No history yet.</div>}
        </div>
        <TapError message={toggleError} />
        <MyVersesSection />
        <button style={M.cancel} onClick={onClose}>Close</button>
      </ModalSheet>
    </div>
  );
}

// #96 — every verse the user has personally saved (manual entry only for
// now — automated Lookup is deferred, see #103). Not date-based like the
// list above it: a straight CRUD list with Edit and Delete, each verse
// tagged "My Verse" wherever it's shown elsewhere in the app.
function MyVersesSection() {
  const [verses, setVerses] = useState<MyVerse[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRef, setEditRef] = useState("");
  const [editText, setEditText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const editSave = useKeyedSaveStatus<string>();
  const rowError = useKeyedTapError<number>();

  const load = useCallback(() => { getList<MyVerse>(`${API}/my-verses`).then(setVerses); }, []);
  useEffect(() => { load(); }, [load]);

  function startEdit(v: MyVerse) {
    setEditingId(v.id);
    setEditRef(v.ref);
    setEditText(v.text);
  }

  async function saveEdit(id: number) {
    const trimmedRef = editRef.trim();
    const trimmedText = editText.trim();
    if (!trimmedRef || !trimmedText) return;
    const ok = await editSave.save(String(id), async () => {
      const res = await apiFetch(`${API}/my-verses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: trimmedRef, text: trimmedText }),
      });
      return res.ok;
    });
    if (ok) {
      setVerses(list => list && list.map(v => (v.id === id ? { ...v, ref: trimmedRef, text: trimmedText } : v)));
      setEditingId(null);
    } else {
      rowError.flash(id, "Couldn't save — try again");
    }
  }

  async function del(id: number) {
    const res = await apiFetch(`${API}/my-verses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVerses(list => list && list.filter(v => v.id !== id));
      setConfirmDeleteId(null);
    } else {
      rowError.flash(id, "Couldn't delete — try again");
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      {/* This label was plain, ambient-styled text (no S.eyeText span) before
          this change — kept that way (font/color: inherit neutralizes the
          browser's own h3 bold/size default) rather than newly adopting
          eyeText's brass small-caps look, to stay a pure semantics change. */}
      <div style={S.eyebrow}><h3 style={{ margin: 0, font: "inherit", color: "inherit" }}>MY VERSES</h3></div>
      {(verses ?? []).map(v => (
        <div key={v.id} style={{ ...S.card, marginTop: 10 }}>
          {editingId === v.id ? (
            <>
              <input style={M.input} value={editRef} onChange={e => setEditRef(e.target.value)} placeholder="Reference (e.g. John 3:16)" />
              <textarea style={{ ...M.input, marginTop: 8 }} rows={2} value={editText} onChange={e => setEditText(e.target.value)} placeholder="Verse text" />
              <SaveStatus status={editSave.get(String(v.id))} onRetry={() => saveEdit(v.id)} />
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button style={S.prioLogLink} onClick={() => saveEdit(v.id)}>Save</button>
                <button style={S.prioLogLink} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ ...S.prioTitle }}>{v.text}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={S.verseRef}>{v.ref.toUpperCase()}</div>
                <span style={{ ...S.upTag, ...S.myVerseTag }}>MY VERSE</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button style={S.prioLogLink} onClick={() => startEdit(v)}>Edit</button>
                {confirmDeleteId === v.id ? (
                  <>
                    <button style={{ ...S.prioLogLink, color: "#C87060" }} onClick={() => del(v.id)}>Yes, delete</button>
                    <button style={S.prioLogLink} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </>
                ) : (
                  <button style={{ ...S.prioLogLink, color: "#C87060" }} onClick={() => setConfirmDeleteId(v.id)}>Delete</button>
                )}
              </div>
              {confirmDeleteId === v.id && <div style={{ ...S.prioSub, color: "#C87060", marginTop: 4 }}>Delete this verse? This can't be undone.</div>}
            </>
          )}
          <TapError message={rowError.get(v.id)} />
        </div>
      ))}
      {verses && verses.length === 0 && <div style={S.empty}>No verses added yet — add your own from Favorite Verses.</div>}
    </div>
  );
}

function VerseFavoritesModal({ onClose, onToggleFavorite }: { onClose: () => void; onToggleFavorite: (ref: string, favorite: boolean, customId?: number) => Promise<boolean> }) {
  const [entries, setEntries] = useState<{ ref: string; text: string; custom: boolean; id: number | null }[] | null>(null);
  const [removingRef, setRemovingRef] = useState<string | null>(null);
  const { error: removeError, flash: flashRemoveError } = useTapError();

  const [addOpen, setAddOpen] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [newText, setNewText] = useState("");
  const [newFavorited, setNewFavorited] = useState(true);
  const addSave = useSaveStatus();
  const { error: addError, flash: flashAddError } = useTapError();

  const load = useCallback(() => {
    getList<{ ref: string; text: string; custom: boolean; id: number | null }>(`${API}/verse-favorites`).then(setEntries);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(entry: { ref: string; custom: boolean; id: number | null }) {
    if (removingRef) return;
    setRemovingRef(entry.ref);
    const ok = await onToggleFavorite(entry.ref, false, entry.custom && entry.id ? entry.id : undefined);
    if (ok) setEntries(list => list && list.filter(e => e.ref !== entry.ref));
    else flashRemoveError("Couldn't save — try again");
    setRemovingRef(null);
  }

  async function addVerse() {
    const trimmedRef = newRef.trim();
    const trimmedText = newText.trim();
    if (!trimmedRef || !trimmedText) {
      flashAddError("A reference and verse text are required");
      return;
    }
    const ok = await addSave.save(async () => {
      const res = await apiFetch(`${API}/my-verses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: trimmedRef, text: trimmedText, favorited: newFavorited }),
      });
      return res.ok;
    });
    if (ok) {
      setNewRef(""); setNewText(""); setNewFavorited(true); setAddOpen(false);
      load();
    } else {
      flashAddError("Couldn't add — try again");
    }
  }

  return (
    <div style={M.overlay}>
      <ModalSheet title="Favorite Verses" onClose={onClose}>
        <div>
          {(entries ?? []).map(entry => (
            <div key={entry.ref} style={S.card}>
              <div style={S.prioHeadRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={S.verseRef}>{entry.ref.toUpperCase()}</div>
                  {entry.custom && <span style={{ ...S.upTag, ...S.myVerseTag }}>MY VERSE</span>}
                </div>
                <button style={S.verseStarBtn} onClick={() => remove(entry)} disabled={removingRef === entry.ref} aria-label="Remove from favorites" aria-pressed={true}>
                  <span style={{ color: C.brass }}>★</span>
                </button>
              </div>
              <div style={{ ...S.prioTitle, marginTop: 6 }}>{entry.text}</div>
            </div>
          ))}
          {entries && entries.length === 0 && <div style={S.empty}>No favorites yet — tap the star on Verse of the Day to save one.</div>}
        </div>
        <TapError message={removeError} />

        <div style={{ marginTop: 16 }}>
          {addOpen ? (
            <div style={S.card}>
              <div style={S.eyebrow}><h3 style={{ margin: 0, font: "inherit", color: "inherit" }}>ADD YOUR OWN VERSE</h3></div>
              <input style={{ ...M.input, marginTop: 8 }} value={newRef} onChange={e => setNewRef(e.target.value)} placeholder="Reference (e.g. John 3:16)" autoFocus />
              <textarea style={{ ...M.input, marginTop: 8 }} rows={2} value={newText} onChange={e => setNewText(e.target.value)} placeholder="Verse text" />
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: C.parchmentDim }}>
                <input type="checkbox" checked={newFavorited} onChange={e => setNewFavorited(e.target.checked)} />
                Favorite this verse (joins the rotation)
              </label>
              <TapError message={addError} />
              <SaveStatus status={addSave.status} onRetry={addVerse} />
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button style={M.next} disabled={addSave.status === "saving"} onClick={addVerse}>
                  {addSave.status === "saving" ? "Adding…" : "Add verse"}
                </button>
                <button style={M.cancel} onClick={() => setAddOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button style={S.prioLogLink} onClick={() => setAddOpen(true)}>+ Add your own verse</button>
          )}
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
      {/* <main>, not <div> (#41 — axe's "region" rule: all page content
          must be contained by a landmark; this was the only content on
          the signed-out screen with none). */}
      <main style={G.wrap}>
        <div style={R.logo}><span style={R.logoText}>Steward</span><span style={R.logoDot}>.</span></div>
        <div style={{ ...R.tagline, textAlign: "center", marginBottom: 38 }}>FOCUSED. FAITHFUL. FREE.</div>
        {loading ? (
          <div style={G.loading}>Loading...</div>
        ) : pendingApproval ? (
          <div style={G.welcome}>Thanks for signing up — you're on the list. We'll let you in soon.</div>
        ) : step === "providers" ? (
          <>
            <div style={G.welcome}>Sign in to Steward</div>
            <button style={G.googleBtn} onClick={() => onLogin("google")}>Continue with Google</button>
            <button style={{ ...G.googleBtn, marginTop: 10 }} onClick={() => onLogin("microsoft")}>Continue with Microsoft</button>
            <button style={{ ...G.googleBtn, marginTop: 10 }} onClick={() => { setError(""); setStep("email"); }}>Continue with Email</button>
            <div style={G.notice}>First time here? Use any option above — we'll review your access and let you know.</div>
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
      </main>
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
  // #37: parchmentLow measures ~3.4:1 against C.ink — fails WCAG AA (needs
  // 4.5:1 for normal text). parchmentDim measures ~6.3:1, comfortably passes.
  loading: { color: C.parchmentDim, fontSize: 14, letterSpacing: "0.04em" },
  welcome: { fontSize: 26, fontWeight: 400, color: C.parchment, textShadow: "0 2px 8px rgba(0,0,0,0.5)", marginBottom: 22, textAlign: "center" },
  googleBtn: { width: "100%", background: "rgba(30,26,16,0.62)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 12, color: C.parchmentMid, fontSize: 14, fontWeight: 700, padding: "13px 16px", cursor: "pointer", fontFamily: F },
  notice: { fontSize: 14, color: C.parchmentDim, marginTop: 14, textAlign: "center" },
  addHome: { marginTop: 18, width: "100%", textAlign: "center" },
  addHomeToggle: { background: "none", border: "none", color: C.brassSoft, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F, textDecoration: "underline", textUnderlineOffset: 3 },
  addHomePanel: { marginTop: 12, background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, padding: "14px 16px", textAlign: "left" },
  addHomeTabs: { display: "flex", gap: 8, marginBottom: 12 },
  addHomeTab: { flex: 1, background: "rgba(20,18,11,0.6)", border: "1px solid rgba(210,190,130,0.14)", borderRadius: 8, color: C.parchmentDim, fontSize: 14, fontWeight: 600, padding: "7px 10px", cursor: "pointer", fontFamily: F, textAlign: "center" },
  addHomeTabOn: { borderColor: C.brass, color: C.brass, boxShadow: `0 0 10px ${C.brassGlow}` },
  addHomeStep: { fontSize: 14, color: C.parchmentMid, lineHeight: 1.5, marginBottom: 6, display: "flex", gap: 8 },
  addHomeStepNum: { color: C.brassSoft, fontWeight: 700, flexShrink: 0 },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const R: Record<string, CSSProperties> = {
  // 100dvh (#37) — 100vh doesn't account for mobile browser toolbars
  // showing/hiding, which clips or letterboxes the layout as they animate.
  root: { width: "100%", maxWidth: 440, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", fontFamily: F, color: C.parchment, position: "relative", overflow: "hidden", background: C.ink },
  woodLayer: { position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url(${WOOD})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
  ambient: { position: "fixed", inset: 0, zIndex: 1, background: "radial-gradient(120% 80% at 50% 0%, rgba(40,36,20,0.25) 0%, rgba(8,10,5,0.45) 70%, rgba(4,5,2,0.7) 100%)" },
  // Safe-area padding (#37) added on top of the existing baseline so the
  // header never sits under the notch/Dynamic Island on devices that have one.
  header: { position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: "calc(54px + env(safe-area-inset-top, 0px))", paddingLeft: "calc(24px + env(safe-area-inset-left, 0px))", paddingRight: "calc(24px + env(safe-area-inset-right, 0px))", paddingBottom: 14 },
  logo: { display: "flex", alignItems: "baseline" },
  logoText: { fontSize: 42, fontWeight: 400, color: C.parchment, letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  logoDot: { fontSize: 42, color: C.brass, textShadow: `0 0 20px ${C.brassGlow}` },
  tagline: { fontSize: 10, letterSpacing: "0.24em", color: C.brassSoft, marginTop: 5, opacity: 0.9 },
  avatar: { width: 46, height: 46, borderRadius: "50%", background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,240,200,0.08)" },
  screen: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 },
  navWrap: { position: "relative", zIndex: 10, background: "linear-gradient(0deg,rgba(8,10,5,0.95),rgba(8,10,5,0.8))", backdropFilter: "blur(20px)" },
  navLine: { height: 1, background: `linear-gradient(90deg,transparent,${C.brassDeep},${C.brass},${C.brassDeep},transparent)`, boxShadow: `0 0 10px ${C.brassGlow}` },
  // Safe-area padding (#37) so the nav bar's bottom padding clears the
  // home-indicator area instead of sitting right up against it.
  nav: { display: "flex", paddingTop: 10, paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" },
  navBtn: { flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  stewardIcon: { width: 20, height: 20, borderRadius: "50%", border: `1.6px solid ${C.parchmentLow}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.parchmentLow, fontFamily: F },
  stewardIconOn: { borderColor: C.brass, color: C.brass, boxShadow: `0 0 10px ${C.brassGlow}` },
  navLabel: { fontSize: 14, color: C.parchmentDim },
  navLabelOn: { color: C.brass },
};
const S: Record<string, CSSProperties> = {
  scroll: { flex: 1, overflowY: "auto", padding: "16px 18px 0", position: "relative" },
  // Bottom fade cue (#37) — hints there's more to scroll without a visible
  // scrollbar; ScrollFadeArea shows/hides it based on actual scroll position.
  scrollFadeCue: { position: "absolute", left: 0, right: 0, bottom: 0, height: 28, background: "linear-gradient(to bottom, transparent, rgba(8,10,5,0.85))", pointerEvents: "none" },
  greetRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 10 },
  greet: { fontSize: 27, fontWeight: 400, color: C.parchment, lineHeight: 1.15, textShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  greetSub: { fontSize: 14, color: C.parchmentDim, marginTop: 5 },
  dateChip: { display: "flex", alignItems: "center", background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 22, padding: "7px 13px", fontSize: 14, color: C.parchmentMid, flexShrink: 0, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" },
  card: { ...glass, padding: "18px 20px", marginBottom: 14 },
  // #40: quiet, not a "content card" — a dismissible orientation note.
  tip: { display: "flex", alignItems: "flex-start", gap: 4, background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, padding: "12px 4px 12px 14px", marginBottom: 14 },
  tipText: { flex: 1, fontSize: 14, color: C.parchmentMid, lineHeight: 1.5 },
  // 44x44 hit area (#37) via padding/negative margins, not a blown-up glyph.
  tipClose: { flexShrink: 0, width: 44, height: 44, marginTop: -10, marginBottom: -10, background: "none", border: "none", color: C.parchmentDim, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F },
  cardCentered: { ...glass, padding: "22px 20px", marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  eyebrow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 12 },
  prioHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  prioLogLink: { background: "none", border: "none", color: C.brassSoft, fontSize: 14, cursor: "pointer", fontFamily: F },
  prioExpandBtn: { width: "100%", background: "none", border: "1px dashed rgba(210,190,130,0.22)", borderRadius: 12, color: C.brassSoft, fontSize: 14, fontWeight: 600, padding: "10px", cursor: "pointer", fontFamily: F, marginTop: 4 },
  eyeText: { fontSize: 11, letterSpacing: "0.16em", color: C.brassSoft, fontWeight: 600 },
  verseText: { fontSize: 18, lineHeight: 1.6, color: C.parchment, marginBottom: 14, textAlign: "center" },
  verseRef: { fontSize: 11, letterSpacing: "0.12em", color: C.brassSoft },
  verseStarBtn: { background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center" },
  intent: { fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  intentInput: { width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontFamily: F, fontSize: 15, lineHeight: 1.7, color: C.parchment, textAlign: "center" },
  empty: { fontSize: 14, color: C.parchmentDim, textAlign: "center", padding: "6px 0" },
  pulseSub: { fontSize: 14, color: C.parchmentDim, marginTop: -6, marginBottom: 14 },
  pulseRow: { marginBottom: 10 },
  pulseRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  pulseLabel: { fontSize: 14, color: C.parchment },
  pulseBtns: { display: "flex", gap: 8 },
  // 44x44 (#37) — minimum comfortable tap target; was 30x30.
  pulseBtn: { width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(210,190,130,0.22)", background: "rgba(30,26,16,0.5)", color: C.parchmentDim, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  pulseNoteInput: { width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(210,190,130,0.16)", outline: "none", fontFamily: F, fontSize: 12, color: C.parchmentMid, padding: "4px 0", marginTop: 6 },
  // ── Sphere walkthrough (#82) ──────────────────────────────────────────────
  sphereProgress: { display: "flex", gap: 5, marginBottom: 16 },
  sphereDot: { flex: 1, height: 4, borderRadius: 2, background: "rgba(210,190,130,0.15)" },
  sphereDotDone: { background: C.brassSoft },
  sphereDotCurrent: { background: C.brass },
  sphereStepLabel: { fontSize: 10, letterSpacing: "0.12em", color: C.parchmentLow, textTransform: "uppercase", marginBottom: 8 },
  sphereQuestion: { fontSize: 16, color: C.parchment, lineHeight: 1.5, marginBottom: 16 },
  sphereAnswerRow: { display: "flex", gap: 8, marginBottom: 14 },
  sphereAnswerBtn: { flex: 1, background: "rgba(30,26,16,0.5)", border: "1px solid rgba(210,190,130,0.22)", borderRadius: 10, color: C.parchmentMid, fontSize: 13, fontWeight: 700, padding: "12px 4px", cursor: "pointer", fontFamily: F, textAlign: "center" },
  sphereFieldLabel: { fontSize: 11, color: C.parchmentLow, margin: "12px 0 4px" },
  sphereFollowup: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed rgba(210,190,130,0.18)" },
  sphereFollowupQ: { fontSize: 13.5, color: C.brassSoft, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 },
  sphereWizNav: { display: "flex", justifyContent: "space-between", marginTop: 18 },
  sphereWizBtn: { background: "none", border: "1px solid rgba(210,190,130,0.28)", color: C.brassSoft, fontFamily: F, fontSize: 13, padding: "8px 16px", borderRadius: 20, cursor: "pointer" },
  sphereWizBtnPrimary: { borderColor: C.brass, color: C.brass, fontWeight: 700 },
  sphereWizBtnDanger: { display: "block", margin: "8px auto 0", borderColor: "rgba(200,112,96,0.4)", color: "#C87060", fontSize: 11.5, padding: "5px 12px" },
  sphereSummaryBox: { fontSize: 12.5, color: C.parchmentMid, lineHeight: 1.7, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 12, marginBottom: 16, maxHeight: 260, overflowY: "auto" },
  sphereDropdownBtn: { background: "none", border: "none", color: C.brassSoft, fontSize: 12.5, fontWeight: 600, padding: "4px 0", cursor: "pointer", fontFamily: F },
  sphereDropdownPanel: { marginTop: 4, marginBottom: 6, paddingLeft: 4 },
  prioLine: { position: "absolute", left: 19, top: 18, bottom: 20, width: 2, background: `linear-gradient(180deg,${C.walnutLite},${C.walnut})`, boxShadow: "0 0 4px rgba(0,0,0,0.5)" },
  prioRow: { display: "flex", gap: 14, alignItems: "flex-start", position: "relative" },
  // 44x44 (#37) — minimum comfortable tap target for the priority-done toggle; was 40x40.
  prioNum: { width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: `radial-gradient(circle at 35% 28%,${C.walnutMid},${C.walnut} 70%,#3E2814)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.parchment, boxShadow: `0 3px 10px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,220,160,0.25),inset 0 -2px 4px rgba(0,0,0,0.4),0 0 0 5px rgba(20,18,11,0.85)`, zIndex: 1, textShadow: "0 1px 2px rgba(0,0,0,0.5)", border: "none", cursor: "pointer" },
  prioNumDone: { background: `radial-gradient(circle at 35% 28%,#7A9860,#4E6838 70%,#26361A)`, opacity: 0.85 },
  prioRowYellow: { boxShadow: `inset 3px 0 0 0 ${C.brass}` },
  prioRowRed: { boxShadow: "inset 3px 0 0 0 #C87060" },
  prioRowGreen: { boxShadow: "inset 3px 0 0 0 #8FAE6E" },
  prioSubRed: { fontSize: 14, color: "#C87060", lineHeight: 1.4 },
  prioSubGreen: { fontSize: 14, color: "#8FAE6E", lineHeight: 1.4 },
  prioEditBtn: { flexShrink: 0, alignSelf: "center", background: "none", border: "none", color: C.brassSoft, fontSize: 14, fontWeight: 600, padding: "6px 4px", cursor: "pointer", fontFamily: F },
  prioTitle: { fontSize: 15, color: C.parchment, lineHeight: 1.4, marginBottom: 3 },
  prioSub: { fontSize: 14, color: C.parchmentDim, lineHeight: 1.4 },
  // Caps a list to roughly 5 rows tall, scrolling for the rest (Completed / Deleted logs).
  scrollCap5: { maxHeight: 300, overflowY: "auto" as const, paddingRight: 4, position: "relative" },
  swipeWrap: { position: "relative", overflow: "hidden", borderRadius: 12, touchAction: "pan-y" },
  swipeFront: { background: "transparent", width: "100%" },
  deleteCue: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 22, border: "none", background: "#C87060", color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontFamily: F },
  completeCue: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 22, border: "none", background: "#8FAE6E", color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontFamily: F },
  upRow: { display: "flex" },
  upCol: { flex: 1, paddingRight: 12 },
  upBorder: { borderRight: "1px solid rgba(210,190,130,0.14)", marginRight: 12 },
  upTime: { display: "flex", alignItems: "center", fontSize: 14, color: C.brassSoft, marginBottom: 6, fontWeight: 600 },
  upTitle: { fontSize: 14, color: C.parchment, marginBottom: 2, fontWeight: 600 },
  upSub: { fontSize: 14, color: C.parchmentDim, marginBottom: 8 },
  upTag: { display: "inline-block", fontSize: 9, letterSpacing: "0.1em", borderRadius: 5, padding: "3px 8px", fontWeight: 600, border: "1px solid" },
  tagWork: { color: "#A8C888", background: "rgba(120,150,90,0.18)", borderColor: "rgba(150,180,110,0.4)" },
  tagHer: { color: "#D4A090", background: "rgba(160,90,70,0.18)", borderColor: "rgba(190,120,100,0.4)" },
  myVerseTag: { color: C.brass, background: "rgba(180,140,80,0.14)", borderColor: "rgba(180,140,80,0.4)" },
  journalCard: { ...glass, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 },
  journalText: { fontSize: 14, color: C.parchmentMid, marginTop: 2 },
  journalInput: { width: "100%", marginTop: 10, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: "10px 12px", outline: "none", resize: "vertical", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  // #38: quiet secondary-button treatment — writing a reflection is
  // optional, not the primary daily action, so this no longer competes
  // with genuinely primary buttons for attention.
  writeBtn: { flexShrink: 0, alignSelf: "flex-start", background: "transparent", border: "1.5px solid rgba(210,190,130,0.3)", borderRadius: 24, color: C.parchmentDim, fontSize: 14, fontWeight: 600, padding: "10px 18px", cursor: "pointer" },
  msgBar: { display: "flex", alignItems: "center", gap: 11, background: "rgba(8,10,5,0.55)", backdropFilter: "blur(8px)", borderRadius: 30, padding: "11px 11px 11px 17px", marginBottom: 14, border: "1px solid rgba(210,190,130,0.16)", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.3)" },
  msgInput: { flex: 1, background: "none", border: "none", color: C.parchment, fontSize: 14, outline: "none", fontFamily: F },
  // 44x44 (#37) — minimum comfortable tap target; msgSend was 36x36, micBtn 32x32.
  msgSend: { width: 44, height: 44, borderRadius: "50%", background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 2px 12px ${C.brassGlow},inset 0 1px 0 rgba(255,240,200,0.3)` },
  micBtn: { width: 44, height: 44, borderRadius: "50%", background: "rgba(30,26,16,0.6)", border: "1px solid rgba(210,190,130,0.16)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" },
  micBtnOn: { background: `radial-gradient(circle at 35% 28%,${C.brass},${C.brassDeep})`, border: `1px solid ${C.brass}`, boxShadow: `0 0 14px ${C.brassGlow}`, animation: "micPulse 1s ease-in-out infinite" },
  bottomTag: { textAlign: "center", fontSize: 10, letterSpacing: "0.18em", color: C.brassSoft, opacity: 0.7, marginBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: 400, color: C.parchment, marginBottom: 4, textShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  pageSub: { fontSize: 14, color: C.parchmentDim, marginBottom: 18 },
  toneRow: { display: "flex", gap: 6, marginBottom: 14, marginTop: -4 },
  toneOpt: { flex: 1, background: "rgba(24,20,12,0.55)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 14, color: C.parchmentDim, fontSize: 14, fontWeight: 600, padding: "7px 4px", cursor: "pointer", fontFamily: F },
  toneOptOn: { borderColor: C.brass, background: "rgba(216,170,62,0.16)", color: C.parchment },
  logRow: { display: "flex", gap: 8, marginBottom: 14 },
  logInput: { flex: 1, background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchment, fontSize: 14, fontFamily: F, padding: "12px 14px", outline: "none", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" },
  logBtn: { background: `linear-gradient(135deg,${C.walnutMid},${C.walnut})`, border: "none", borderRadius: 12, color: C.parchment, fontSize: 14, fontWeight: 700, padding: "12px 18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,220,160,0.15)" },
  commitRow: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  commitCard: { display: "flex", flexDirection: "column", width: "100%", background: "transparent" },
  commitExpandBtn: { flexShrink: 0, alignSelf: "center", background: "none", border: "none", color: C.parchmentDim, fontSize: 14, padding: "6px 4px", cursor: "pointer", fontFamily: F },
  commitExpandPanel: { marginLeft: 34, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(210,190,130,0.12)", display: "flex", flexDirection: "column", gap: 6 },
  tribeRow: { display: "flex", gap: 12, alignItems: "center", marginBottom: 10 },
  tribeNameBtn: { flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: F, padding: 0 },
  dragHandle: { flexShrink: 0, width: 22, background: "none", border: "none", color: C.parchmentLow, fontSize: 16, cursor: "grab", padding: "6px 0", touchAction: "none", fontFamily: F },
  peopleDivider: { height: 1, background: "rgba(210,190,130,0.14)", margin: "4px 0 10px" },
  tribeTagSelect: { width: "100%", background: "rgba(8,10,5,0.6)", border: "1px solid rgba(210,190,130,0.16)", borderRadius: 12, color: C.parchmentMid, fontSize: 14, fontFamily: F, padding: "10px 12px", outline: "none", marginBottom: 14 },
  // 44x44 (#37) — minimum comfortable tap target for the kept/reopen toggle; was 22x22.
  dot: { width: 44, height: 44, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: "rgba(0,0,0,0.2)", border: `1.5px solid ${C.parchmentLow}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#7AB46A", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)" },
  dotDone: { background: "rgba(120,180,106,0.25)", borderColor: "#7AB46A" },
  jobRow: { marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(210,190,130,0.12)" },
  workList: { ...glass, padding: "10px 0", marginBottom: 12 },
  workGroup: { fontSize: 14, fontWeight: 800, letterSpacing: "0.13em", padding: "8px 16px 5px" },
  workRow: { width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", alignItems: "center", background: "transparent", border: "none", borderTop: "1px solid rgba(210,190,130,0.09)", color: C.parchment, textAlign: "left", padding: "9px 16px 10px", cursor: "pointer", fontFamily: F },
  workMain: { minWidth: 0 },
  workName: { fontSize: 14, color: C.parchment, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  workMeta: { fontSize: 14, color: C.parchmentDim, lineHeight: 1.35, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  workPct: { fontSize: 14, color: C.brassSoft, fontWeight: 700, gridColumn: "2", gridRow: "1 / span 2" },
  workTrack: { gridColumn: "1 / -1", height: 3, background: "rgba(0,0,0,0.42)", borderRadius: 3, overflow: "hidden", marginTop: 6 },
  workTrackFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  jobTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  trackRow: { display: "flex", alignItems: "center", gap: 8 },
  track: { flex: 1, height: 5, background: "rgba(0,0,0,0.45)", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" },
  trackFill: { height: "100%", borderRadius: 3, transition: "width 0.4s" },
  intakeBtn: { width: "100%", borderRadius: 14, border: `1px dashed ${C.walnutLite}80`, background: "rgba(90,58,32,0.18)", color: C.parchmentMid, fontSize: 14, fontWeight: 600, padding: "15px", cursor: "pointer", fontFamily: F },
  chatWrap: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 12 },
  chatMsgs: { flex: 1, overflowY: "auto", padding: "12px 18px", position: "relative" },
  bubble: { marginBottom: 14, maxWidth: "86%" },
  bubbleA: { marginRight: "auto" },
  bubbleU: { marginLeft: "auto" },
  bubbleName: { fontSize: 9, letterSpacing: "0.14em", color: C.brassSoft, marginBottom: 5, fontWeight: 600 },
  bubbleText: { ...glass, padding: "13px 15px", fontSize: 14, lineHeight: 1.65, color: C.parchment, display: "inline-block", whiteSpace: "pre-wrap", borderTopLeftRadius: 5 },
  chatPrioChip: { alignSelf: "flex-start", background: "rgba(216,170,62,0.14)", border: "1px solid rgba(216,170,62,0.4)", borderRadius: 16, color: C.brassSoft, fontSize: 14, fontWeight: 600, padding: "6px 12px", cursor: "pointer", fontFamily: F },
  bubbleTextU: { background: `linear-gradient(135deg,${C.walnut},${C.walnutMid})`, border: `1px solid ${C.walnutLite}50`, borderTopLeftRadius: 18, borderTopRightRadius: 5 },
  chatBar: { display: "flex", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid rgba(210,190,130,0.12)", alignItems: "center" },
  calendarCard: { ...glass, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  calendarTitle: { fontSize: 14, color: C.parchment, fontWeight: 700, marginBottom: 3 },
  calendarBtn: { background: `linear-gradient(135deg,${C.walnutMid},${C.walnut})`, border: "none", borderRadius: 12, color: C.parchment, fontSize: 14, fontWeight: 700, padding: "10px 14px", cursor: "pointer", fontFamily: F, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,220,160,0.15)" },
  calendarRemoveBtn: { background: "none", border: `1px solid rgba(200,112,96,0.4)`, borderRadius: 8, color: "#C87060", fontSize: 14, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: F, flexShrink: 0 },
  weekRow: { display: "flex", gap: 14, alignItems: "flex-start", paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid rgba(210,190,130,0.12)" },
  weekToday: { ...glass, padding: "14px", border: `1px solid ${C.brass}50`, boxShadow: `0 0 18px ${C.brassGlow}`, margin: "0 -2px 14px" },
  weekL: { width: 42, flexShrink: 0 },
  weekDay: { fontSize: 14, fontWeight: 700, color: C.parchmentMid, textTransform: "uppercase" },
  todayPill: { fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`, color: C.ink, borderRadius: 6, padding: "3px 9px", fontWeight: 700, alignSelf: "center", flexShrink: 0, boxShadow: `0 2px 8px ${C.brassGlow}` },
  weekItem: { marginBottom: 8 },
  weekItemTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  weekTime: { fontSize: 14, color: C.brassSoft, flexShrink: 0 },
  calendarBottom: { borderTop: "1px solid rgba(210,190,130,0.12)", marginTop: 8, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" },
  calendarAccount: { display: "flex", justifyContent: "space-between", alignItems: "center", color: C.parchmentDim, fontSize: 14 },
  calendarSmallBtn: { alignSelf: "stretch", background: "rgba(30,26,16,0.62)", border: "1px solid rgba(210,190,130,0.18)", borderRadius: 10, color: C.parchmentMid, fontSize: 14, fontWeight: 700, padding: "10px 12px", cursor: "pointer", fontFamily: F },
  // #115 — sticky calendar header: the month bar, title, subtitle, and
  // visibility toggles all stay pinned to the top of the tab's own scroll
  // container (S.scroll) as the day list scrolls beneath them, instead of
  // scrolling away with the content. The negative top margin (matching
  // S.scroll's own 16px top padding) makes the header's background hug the
  // very top edge of the scroll container instead of leaving a dead,
  // unstuck gap above it — same bleed technique the horizontal
  // -18px margin already used, just extended to the top. Background/blur
  // mirrors R.navWrap (the bottom nav bar) — this app's one other piece of
  // persistent chrome — rather than the warm walnut `glass` card gradient,
  // which is meant for content cards floating on the page, not an overlay
  // sitting on top of scrolling content. `calendarHeaderLine` below plays
  // the same role as R.navLine: the brass divider that actually separates
  // persistent chrome from the content underneath it.
  calendarHeader: {
    position: "sticky", top: -16, zIndex: 2,
    background: "linear-gradient(180deg, rgba(8,10,5,0.97) 0%, rgba(8,10,5,0.90) 100%)",
    backdropFilter: "blur(20px)",
    margin: "-16px -18px 14px", padding: "16px 18px 14px",
  },
  calendarHeaderLine: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 1,
    background: `linear-gradient(90deg,transparent,${C.brassDeep},${C.brass},${C.brassDeep},transparent)`,
    boxShadow: `0 0 10px ${C.brassGlow}`,
  },
  calendarMonthBar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  calendarMonthArrow: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(210,190,130,0.35)", borderRadius: "50%",
    width: 30, height: 30, color: C.brassSoft, fontSize: 16, cursor: "pointer", fontFamily: F,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  calendarMonthLabel: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700, color: C.parchment },
  calendarSyncBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(210,190,130,0.35)", borderRadius: "50%",
    width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  // Lives in the month bar next to the arrows/sync button (moved out of
  // its earlier spot as a button floating over the day list).
  calendarTodayBtn: {
    background: "rgba(216,170,62,0.12)", border: `1px solid ${C.brass}`, borderRadius: 14,
    color: C.brass, fontSize: 12, fontWeight: 700, padding: "0 12px", height: 30,
    cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
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
  // every modal in the app shares this one sheet style (#66). 88dvh, not
  // 88vh (matches R.root's #37 fix, never applied here) — vh is the
  // *largest* possible viewport in a mobile browser, so a modal sized
  // against it can render with its bottom (here, the Cancel button) below
  // the actually-visible area once the browser's own chrome (address bar,
  // or an embedded preview's own frame) is accounted for; dvh tracks the
  // real visible viewport instead. overscrollBehavior: none (#86) stops
  // scroll chaining once you hit the sheet's own top/bottom edge — without
  // it, the gesture falls through to the page behind this fixed overlay,
  // which rubber-bands (mainly iOS Safari) and snaps back once released,
  // reading as "scroll up, then it bounces back." An earlier cut used
  // "contain", which per spec only stops that chaining to the page behind —
  // it explicitly still permits the browser's own rubber-band bounce to
  // render on the sheet's *own* edges, which is exactly what kept the bug
  // alive on any modal with enough content to actually reach an edge (Tribe's
  // Log a Commitment/Kept/Deleted lists, Sphere's History and walkthrough
  // wizard) while shorter Work-tab forms never scrolled far enough to show
  // it. "none" is a strict superset of "contain" (still blocks chaining,
  // additionally suppresses the local bounce too), so there's no tradeoff.
  sheet: { width: "100%", maxWidth: 440, margin: "0 auto", maxHeight: "88dvh", position: "relative", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "none", background: "linear-gradient(160deg,rgba(34,30,18,0.98),rgba(16,14,8,0.98))", backdropFilter: "blur(24px)", borderRadius: "22px 22px 0 0", padding: "24px 24px 48px", border: "1px solid rgba(210,190,130,0.18)", borderBottom: "none", boxShadow: "0 -10px 50px rgba(0,0,0,0.7)" },
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
  cancel: { width: "100%", background: "none", border: "none", color: C.parchmentDim, fontSize: 14, cursor: "pointer", padding: "10px", fontFamily: F },
  // Back/Next side-by-side step nav (SIM-05, JobModal's own wizard —
  // same idiom as SphereWalkthroughModal's sphereWizNav/sphereWizBtn*,
  // rebuilt here with M's own tokens instead of reusing those directly).
  wizNav: { display: "flex", gap: 10, marginBottom: 8 },
  wizBack: { flex: "0 0 auto", background: "none", border: "1px solid rgba(210,190,130,0.28)", borderRadius: 12, color: C.parchmentDim, fontSize: 14, padding: "15px 18px", cursor: "pointer", fontFamily: F },
  wizNext: { flex: 1, background: `linear-gradient(135deg,${C.brass},${C.brassDeep})`, border: "none", borderRadius: 12, color: C.ink, fontSize: 15, fontWeight: 700, padding: "15px", cursor: "pointer", fontFamily: F, boxShadow: `0 4px 18px ${C.brassGlow}` },
  // Final editable review/summary screen (SIM-05).
  summaryBox: { background: "rgba(8,10,5,0.5)", border: "1px solid rgba(210,190,130,0.14)", borderRadius: 12, padding: 14, marginBottom: 16, maxHeight: 320, overflowY: "auto" },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  summaryLabel: { fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.brassSoft },
  summaryValue: { fontSize: 14, color: C.parchment, marginTop: 2 },
  summaryEdit: { flex: "none", background: "none", border: "1px solid rgba(210,190,130,0.28)", borderRadius: 14, color: C.brassSoft, fontSize: 12, padding: "5px 12px", cursor: "pointer", fontFamily: F },
};
const E: Record<string, CSSProperties> = {
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 14, letterSpacing: "0.1em", color: C.brassSoft, fontWeight: 600, marginBottom: 6 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, marginTop: -4 },
  chip: { background: "rgba(34,30,18,0.9)", border: "1px solid rgba(210,190,130,0.22)", borderRadius: 20, color: C.parchmentMid, fontSize: 14, padding: "7px 14px", cursor: "pointer", fontFamily: F },
  slider: { width: "100%", accentColor: C.brass, marginBottom: 12 },
};
