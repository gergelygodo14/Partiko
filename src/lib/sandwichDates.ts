import { addDaysStr, parseDay } from "@/lib/dates";

const SANDWICH_TIMEZONE = "Europe/Budapest";

// Confirmed with the owner: the printed price list says phone orders close
// at 13:00, but the self-service app is deliberately given one extra hour.
export const SANDWICH_ORDER_CUTOFF_HOUR = 14;

const DAY_NAMES_HU = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];

// Minimal, self-contained duplicate of dates.ts's private budapestDateAndHour
// - kept independent on purpose so this file never needs to import from or
// modify the ready-meal dates.ts internals.
function budapestDateAndHour(now: Date): { dateStr: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SANDWICH_TIMEZONE,
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

function isWeekend(dateStr: string): boolean {
  const day = parseDay(dateStr).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 || day === 6;
}

export type SandwichTargetDay = { date: string; dayName: string };

export function toTargetDay(dateStr: string): SandwichTargetDay {
  return { date: dateStr, dayName: DAY_NAMES_HU[parseDay(dateStr).getUTCDay()] };
}

/** The date customers are currently allowed to submit/edit a sandwich order
 *  for: tomorrow if it's still before the cutoff hour today, otherwise the
 *  day after tomorrow - then rolled forward over Saturday/Sunday to Monday
 *  (no weekend delivery). This gives Monday's order window the whole
 *  weekend (open continuously from Thursday's cutoff through Sunday's),
 *  while Friday's window is only the single day before it. */
export function getSandwichOrderTargetDay(now: Date = new Date()): SandwichTargetDay {
  const { dateStr, hour } = budapestDateAndHour(now);
  let target = addDaysStr(dateStr, hour < SANDWICH_ORDER_CUTOFF_HOUR ? 1 : 2);
  while (isWeekend(target)) target = addDaysStr(target, 1);
  return toTargetDay(target);
}

/** Always literally "tomorrow" (weekend-skipped to Monday), with no
 *  cutoff-hour jump - unlike getSandwichOrderTargetDay, this must NOT jump
 *  ahead at the order cutoff, because right after that cutoff passes the
 *  kitchen still needs to download the now-finalized "tomorrow" list, not
 *  an empty, still-forming day-after-tomorrow list. Mirrors how the
 *  ready-meal getExportDay is also a plain, cutoff-free "tomorrow". */
export function getSandwichExportDay(now: Date = new Date()): SandwichTargetDay {
  const { dateStr } = budapestDateAndHour(now);
  let target = addDaysStr(dateStr, 1);
  while (isWeekend(target)) target = addDaysStr(target, 1);
  return toTargetDay(target);
}

