// #181 Phase 1 — canonical Protestant Bible structure (66 books, chapter
// counts) and the pure functions that turn a plan's four fixed parameters
// (testament order, starting point, plan length) into "what to read on day
// N." Book/chapter divisions date to the 1500s and are identical across
// virtually every translation — public-domain structural data, unrelated
// to the NIV-text licensing risk that blocked #103. This file deliberately
// never stores or returns verse *text*, only references.

export type Testament = "old" | "new";

export interface BibleBook {
  name: string;
  testament: Testament;
  chapters: number;
}

// Order within each testament is the canonical Protestant order. Chapter
// counts sum to 929 (OT) + 260 (NT) = 1189 total, the standard figure for
// this canon.
export const BIBLE_BOOKS: BibleBook[] = [
  { name: "Genesis", testament: "old", chapters: 50 },
  { name: "Exodus", testament: "old", chapters: 40 },
  { name: "Leviticus", testament: "old", chapters: 27 },
  { name: "Numbers", testament: "old", chapters: 36 },
  { name: "Deuteronomy", testament: "old", chapters: 34 },
  { name: "Joshua", testament: "old", chapters: 24 },
  { name: "Judges", testament: "old", chapters: 21 },
  { name: "Ruth", testament: "old", chapters: 4 },
  { name: "1 Samuel", testament: "old", chapters: 31 },
  { name: "2 Samuel", testament: "old", chapters: 24 },
  { name: "1 Kings", testament: "old", chapters: 22 },
  { name: "2 Kings", testament: "old", chapters: 25 },
  { name: "1 Chronicles", testament: "old", chapters: 29 },
  { name: "2 Chronicles", testament: "old", chapters: 36 },
  { name: "Ezra", testament: "old", chapters: 10 },
  { name: "Nehemiah", testament: "old", chapters: 13 },
  { name: "Esther", testament: "old", chapters: 10 },
  { name: "Job", testament: "old", chapters: 42 },
  { name: "Psalms", testament: "old", chapters: 150 },
  { name: "Proverbs", testament: "old", chapters: 31 },
  { name: "Ecclesiastes", testament: "old", chapters: 12 },
  { name: "Song of Solomon", testament: "old", chapters: 8 },
  { name: "Isaiah", testament: "old", chapters: 66 },
  { name: "Jeremiah", testament: "old", chapters: 52 },
  { name: "Lamentations", testament: "old", chapters: 5 },
  { name: "Ezekiel", testament: "old", chapters: 48 },
  { name: "Daniel", testament: "old", chapters: 12 },
  { name: "Hosea", testament: "old", chapters: 14 },
  { name: "Joel", testament: "old", chapters: 3 },
  { name: "Amos", testament: "old", chapters: 9 },
  { name: "Obadiah", testament: "old", chapters: 1 },
  { name: "Jonah", testament: "old", chapters: 4 },
  { name: "Micah", testament: "old", chapters: 7 },
  { name: "Nahum", testament: "old", chapters: 3 },
  { name: "Habakkuk", testament: "old", chapters: 3 },
  { name: "Zephaniah", testament: "old", chapters: 3 },
  { name: "Haggai", testament: "old", chapters: 2 },
  { name: "Zechariah", testament: "old", chapters: 14 },
  { name: "Malachi", testament: "old", chapters: 4 },
  { name: "Matthew", testament: "new", chapters: 28 },
  { name: "Mark", testament: "new", chapters: 16 },
  { name: "Luke", testament: "new", chapters: 24 },
  { name: "John", testament: "new", chapters: 21 },
  { name: "Acts", testament: "new", chapters: 28 },
  { name: "Romans", testament: "new", chapters: 16 },
  { name: "1 Corinthians", testament: "new", chapters: 16 },
  { name: "2 Corinthians", testament: "new", chapters: 13 },
  { name: "Galatians", testament: "new", chapters: 6 },
  { name: "Ephesians", testament: "new", chapters: 6 },
  { name: "Philippians", testament: "new", chapters: 4 },
  { name: "Colossians", testament: "new", chapters: 4 },
  { name: "1 Thessalonians", testament: "new", chapters: 5 },
  { name: "2 Thessalonians", testament: "new", chapters: 3 },
  { name: "1 Timothy", testament: "new", chapters: 6 },
  { name: "2 Timothy", testament: "new", chapters: 4 },
  { name: "Titus", testament: "new", chapters: 3 },
  { name: "Philemon", testament: "new", chapters: 1 },
  { name: "Hebrews", testament: "new", chapters: 13 },
  { name: "James", testament: "new", chapters: 5 },
  { name: "1 Peter", testament: "new", chapters: 5 },
  { name: "2 Peter", testament: "new", chapters: 3 },
  { name: "1 John", testament: "new", chapters: 5 },
  { name: "2 John", testament: "new", chapters: 1 },
  { name: "3 John", testament: "new", chapters: 1 },
  { name: "Jude", testament: "new", chapters: 1 },
  { name: "Revelation", testament: "new", chapters: 22 },
];

export const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0); // 1189

// A commonly-cited approximate total, shown only as a motivational
// "verses/day" statistic during setup — never used to compute the actual
// (always whole-chapter) daily assignment.
export const APPROX_TOTAL_VERSES = 31102;

export interface ChapterRef {
  book: string;
  chapter: number;
}

const bookByName = new Map(BIBLE_BOOKS.map((b) => [b.name, b]));

// The full 1189-entry reading order for a plan: every chapter of the
// chosen starting testament (beginning at startBook/startChapter and
// wrapping around to cover any books that come before it), then every
// chapter of the other testament in canonical order. This is what makes a
// custom start point "wrap around" rather than permanently skip books.
export function orderedChapterList(testamentFirst: Testament, startBook: string, startChapter: number): ChapterRef[] {
  const startBookInfo = bookByName.get(startBook);
  if (!startBookInfo) throw new Error(`Unknown book: ${startBook}`);

  const firstTestamentBooks = BIBLE_BOOKS.filter((b) => b.testament === testamentFirst);
  const secondTestamentBooks = BIBLE_BOOKS.filter((b) => b.testament !== testamentFirst);

  const startIdx = firstTestamentBooks.findIndex((b) => b.name === startBook);
  // Books from the start point through the end of the testament, then
  // wrapping back to the beginning of the testament up to (not including)
  // the start book — covers every book exactly once.
  const wrappedFirstTestament = [...firstTestamentBooks.slice(startIdx), ...firstTestamentBooks.slice(0, startIdx)];

  const list: ChapterRef[] = [];
  wrappedFirstTestament.forEach((book, bookPos) => {
    const firstChapter = bookPos === 0 ? startChapter : 1;
    for (let ch = firstChapter; ch <= book.chapters; ch++) list.push({ book: book.name, chapter: ch });
  });
  secondTestamentBooks.forEach((book) => {
    for (let ch = 1; ch <= book.chapters; ch++) list.push({ book: book.name, chapter: ch });
  });
  return list;
}

// Evenly distributes the ordered chapter list across totalDays using
// cumulative rounding (the standard "spread N items over M buckets" trick)
// so every day gets a whole number of chapters summing exactly to the
// list's length — never a chapter split across two days. If totalDays
// exceeds the list length, the trailing days simply get zero new chapters
// (the plan is already fully assigned by then).
export function chaptersForDay(dayIndex: number, totalDays: number, orderedList: ChapterRef[]): ChapterRef[] {
  if (dayIndex < 0 || dayIndex >= totalDays) return [];
  const total = orderedList.length;
  const cumulativeThrough = (d: number) => Math.round(((d + 1) * total) / totalDays);
  const startPos = dayIndex === 0 ? 0 : cumulativeThrough(dayIndex - 1);
  const endPos = cumulativeThrough(dayIndex);
  return orderedList.slice(startPos, endPos);
}

// "Genesis 1-3" for a same-book run, "Genesis 50; Exodus 1" across a book
// boundary within the same day — never renders verse text, only the
// book/chapter reference(s) assigned.
export function formatReading(chapters: ChapterRef[]): string {
  if (chapters.length === 0) return "";
  const groups: { book: string; from: number; to: number }[] = [];
  for (const c of chapters) {
    const last = groups[groups.length - 1];
    if (last && last.book === c.book && c.chapter === last.to + 1) last.to = c.chapter;
    else groups.push({ book: c.book, from: c.chapter, to: c.chapter });
  }
  return groups.map((g) => (g.from === g.to ? `${g.book} ${g.from}` : `${g.book} ${g.from}-${g.to}`)).join("; ");
}

export function defaultStartBook(testamentFirst: Testament): string {
  return testamentFirst === "old" ? "Genesis" : "Matthew";
}

export function isValidBook(name: string): boolean {
  return bookByName.has(name);
}

export function bookChapterCount(name: string): number | null {
  return bookByName.get(name)?.chapters ?? null;
}

// ── Plan-view computation, shared by the API route, Steward's chat
// context, and the Calendar/coming-up merge — so none of the three can
// drift on what "today's reading" or "the streak" actually means. ──

export function dayIndexForDate(startDate: string, dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - new Date(startDate).getTime()) / 86400000);
}

// Grace rule from #187's grilling: a day older than yesterday left
// incomplete breaks the streak outright (returns 0). Otherwise the streak
// is the count of consecutive completed days working backward from today
// (or from yesterday, if today's reading hasn't been done yet) — one day
// of lag is always tolerated without penalty.
export function computeStreak(completedDayIndexes: Set<number>, currentDayIndex: number): number {
  for (let i = 0; i <= currentDayIndex - 2; i++) {
    if (!completedDayIndexes.has(i)) return 0;
  }
  let i = completedDayIndexes.has(currentDayIndex) ? currentDayIndex : currentDayIndex - 1;
  let streak = 0;
  while (i >= 0 && completedDayIndexes.has(i)) { streak++; i--; }
  return streak;
}

export interface BacklogEntry {
  dayIndex: number;
  reading: string;
}

export interface PlanView {
  currentDayIndex: number;
  totalChaptersAssigned: number;
  streak: number;
  progressPct: number;
  isPlanComplete: boolean;
  // Every not-yet-completed day from the plan's start through today,
  // oldest first — shown all at once so catching up on a multi-day gap
  // doesn't require multiple round-trips (#187 grilling, Q15).
  backlog: BacklogEntry[];
}

export function buildPlanView(
  plan: { startDate: string; totalDays: number; testamentFirst: Testament; startBook: string; startChapter: number },
  completedDayIndexes: Set<number>,
  todayStr: string,
): PlanView {
  const orderedList = orderedChapterList(plan.testamentFirst, plan.startBook, plan.startChapter);
  const rawDayIndex = dayIndexForDate(plan.startDate, todayStr);
  const currentDayIndex = Math.max(0, Math.min(rawDayIndex, plan.totalDays - 1));
  const isPlanComplete = rawDayIndex >= plan.totalDays && completedDayIndexes.size >= plan.totalDays;

  const backlog: BacklogEntry[] = [];
  for (let i = 0; i <= currentDayIndex; i++) {
    if (completedDayIndexes.has(i)) continue;
    const reading = formatReading(chaptersForDay(i, plan.totalDays, orderedList));
    if (reading) backlog.push({ dayIndex: i, reading });
  }

  return {
    currentDayIndex,
    totalChaptersAssigned: orderedList.length,
    streak: computeStreak(completedDayIndexes, currentDayIndex),
    progressPct: Math.round((completedDayIndexes.size / plan.totalDays) * 100),
    isPlanComplete,
    backlog,
  };
}
