export type RecurrencePeriod = "daily" | "weekly" | "monthly";

function toUTCDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const d = toUTCDate(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function periodKey(period: RecurrencePeriod, dateKey: string): string {
  if (period === "daily") return dateKey;
  if (period === "monthly") return dateKey.slice(0, 7);
  const d = toUTCDate(dateKey);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  return addDays(dateKey, -mondayOffset);
}

export function periodBounds(period: RecurrencePeriod, key: string): { start: string; end: string } {
  if (period === "daily") return { start: key, end: key };
  if (period === "weekly") return { start: key, end: addDays(key, 6) };
  const [y, m] = key.split("-").map(Number);
  const start = `${key}-01`;
  const end = toDateKey(new Date(Date.UTC(y, m, 0))); // day 0 of next month = last day of this month
  return { start, end };
}

export function previousPeriodKey(period: RecurrencePeriod, key: string): string {
  if (period === "daily") return addDays(key, -1);
  if (period === "weekly") return addDays(key, -7);
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function computeCurrentPeriodStats(
  period: RecurrencePeriod,
  target: number,
  completions: string[],
  todayKey: string
): { key: string; completedCount: number; target: number; pct: number } {
  const safeTarget = target > 0 ? target : 1;
  const key = periodKey(period, todayKey);
  const { start, end } = periodBounds(period, key);
  const completedCount = new Set(completions.filter(c => c >= start && c <= end)).size;
  const pct = Math.min(100, Math.round((completedCount / safeTarget) * 100));
  return { key, completedCount, target: safeTarget, pct };
}

export function computeStreak(
  period: RecurrencePeriod,
  target: number,
  completions: string[],
  todayKey: string,
  createdKey: string
): number {
  const safeTarget = target > 0 ? target : 1;
  const completedSet = new Set(completions);
  let cursor = periodKey(period, todayKey);
  let streak = 0;
  let isCurrent = true;
  // Bounded by the task's creation date; also hard-capped as a safety net.
  for (let i = 0; i < 1000; i++) {
    const { start, end } = periodBounds(period, cursor);
    if (end < createdKey) break;
    let count = 0;
    for (const c of completedSet) if (c >= start && c <= end) count++;
    const hit = count >= safeTarget;
    if (hit) {
      streak++;
    } else if (!isCurrent) {
      break; // a past, fully-elapsed period that missed target ends the streak
    }
    // an in-progress current period that hasn't hit target yet doesn't break the streak
    isCurrent = false;
    if (start <= createdKey) break;
    cursor = previousPeriodKey(period, cursor);
  }
  return streak;
}
