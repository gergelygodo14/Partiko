export function parseDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function dayRange(dateStr: string): { gte: Date; lt: Date } {
  const start = parseDay(dateStr);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export function rangeBetween(fromStr: string, toStr: string): { gte: Date; lt: Date } {
  const gte = parseDay(fromStr);
  const lt = parseDay(toStr);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDayStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = parseDay(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDayStr(d);
}

export function mondayOf(dateStr: string): string {
  const d = parseDay(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDayStr(d);
}

// Ordering business rule: Thursday 10:00 is when the kitchen cooks Friday's
// (the week's last) meal, so ordering against the current week must close
// then; customers then order against next week once its menu is published.
const ORDER_TIMEZONE = "Europe/Budapest";
export const ORDER_CUTOFF_DAY_INDEX = 3; // Thursday, 0=Monday
export const ORDER_CUTOFF_HOUR = 10;

export type ActiveOrderWeek = {
  weekStart: string;
  isCurrentWeek: boolean;
};

// Vercel serverless functions run in UTC regardless of deploy region, so the
// cutoff (a wall-clock time for Hungarian kitchen staff) must be evaluated
// against the Budapest local time, not `now`'s UTC hour.
function budapestDateAndHour(now: Date): { dateStr: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

function mondayIndexOf(dateStr: string): number {
  const day = parseDay(dateStr).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 6 : day - 1; // 0=Mon..6=Sun
}

/** Which week customers currently order against, per the Thursday-10:00 cutoff. */
export function getActiveOrderWeek(now: Date): ActiveOrderWeek {
  const { dateStr, hour } = budapestDateAndHour(now);
  const currentWeekStart = mondayOf(dateStr);
  const dayIndex = mondayIndexOf(dateStr);
  const isBeforeCutoff =
    dayIndex < ORDER_CUTOFF_DAY_INDEX ||
    (dayIndex === ORDER_CUTOFF_DAY_INDEX && hour < ORDER_CUTOFF_HOUR);

  return isBeforeCutoff
    ? { weekStart: currentWeekStart, isCurrentWeek: true }
    : { weekStart: addDaysStr(currentWeekStart, 7), isCurrentWeek: false };
}

/** Weekday indexes (0=Mon..4=Fri) of the active week that must stay locked to
 *  edits: the kitchen preps each weekday's food the calendar day before at
 *  ORDER_CUTOFF_HOUR, so today's meal is always already locked (it was
 *  prepped yesterday), and tomorrow's locks too once today's cutoff passes.
 *  Always empty for next week (nothing prepped yet). */
export function getLockedDayIndexes(activeWeek: ActiveOrderWeek, now: Date): number[] {
  if (!activeWeek.isCurrentWeek) return [];
  const { dateStr, hour } = budapestDateAndHour(now);
  const todayIndex = mondayIndexOf(dateStr);
  const lockedCount = hour >= ORDER_CUTOFF_HOUR ? todayIndex + 2 : todayIndex + 1;
  return Array.from({ length: Math.min(lockedCount, 5) }, (_, i) => i);
}

export type ExportDay = {
  date: string;
  weekStart: string;
  dayIndex: number | null; // 0=Mon..4=Fri; null when tomorrow is a Sat/Sun (no menu day)
};

// The kitchen preps each weekday's food the calendar day before (e.g. Sunday
// preps Monday's, Thursday preps Friday's) - so the daily kitchen printout
// always reflects tomorrow's orders, evaluated in Budapest local time.
export function getExportDay(now: Date): ExportDay {
  const { dateStr } = budapestDateAndHour(now);
  const date = addDaysStr(dateStr, 1);
  const weekday = parseDay(date).getUTCDay(); // 0=Sun..6=Sat
  return {
    date,
    weekStart: mondayOf(date),
    dayIndex: weekday >= 1 && weekday <= 5 ? weekday - 1 : null,
  };
}
