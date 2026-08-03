import { addDaysStr, parseDay } from "@/lib/dates";

// Mon-Fri only, matching the business's delivery week (no weekend delivery) -
// deliberately NOT the same as sandwichDates.ts's DAY_NAMES_HU, which is a
// 7-element Sunday-first array indexed by getUTCDay() for naming a single
// calendar date. These two are indexed by weekday 0=Mon..4=Fri, the same
// convention as OrderLine.dayIndex and WeeklyMenu.days.
//
// Previously duplicated verbatim in both SandwichOrdersTab.tsx and
// ReadyMealOrdersTab.tsx; extracted here rather than adding a third copy for
// the order-entry screen. Deliberately not named sandwich* - the labels and
// the 0=Mon..4=Fri index convention are shared with the ready-meal side.
export const SHORT_DAY_NAMES = ["H", "K", "Sze", "Cs", "P"] as const;
export const FULL_DAY_NAMES = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"] as const;

// Hungarian inflections for UI copy. Written out rather than derived from
// FULL_DAY_NAMES because the suffixes are irregular ("szerdára" but "keddre",
// "csütörtöki" but "pénteki") and a lowercase + suffix concat produces wrong
// forms like "szerdare".
/** "a szerdai listáról" */
export const DAY_ADJECTIVES = ["hétfői", "keddi", "szerdai", "csütörtöki", "pénteki"] as const;
/** "csak szerdára" */
export const DAY_ONTO = ["hétfőre", "keddre", "szerdára", "csütörtökre", "péntekre"] as const;

export const WEEKDAY_COUNT = FULL_DAY_NAMES.length;

/** 0=Mon..4=Fri, or null for a Saturday/Sunday date (no delivery day). */
export function weekdayIndexOf(dateStr: string): number | null {
  const day = parseDay(dateStr).getUTCDay(); // 0=Sun..6=Sat
  return day >= 1 && day <= 5 ? day - 1 : null;
}

/** The calendar date of a given weekday within the week starting at weekStart
 *  (which must be a Monday - pass it through mondayOf() if unsure). */
export function dateForWeekday(weekStart: string, weekdayIndex: number): string {
  return addDaysStr(weekStart, weekdayIndex);
}

/** True for Mon-Fri. The order-entry screen refuses weekend dates outright:
 *  nothing in the app can read an order placed on a non-delivery day. */
export function isDeliveryWeekday(dateStr: string): boolean {
  return weekdayIndexOf(dateStr) !== null;
}

/** The weekday tab to open by default: the next delivery day after today
 *  (skipping the weekend), since a phone order taken "now" is for that day,
 *  not for today itself - e.g. a Monday call defaults to the Tuesday tab. */
export function defaultEntryDate(todayStr: string): string {
  let candidate = addDaysStr(todayStr, 1);
  while (!isDeliveryWeekday(candidate)) candidate = addDaysStr(candidate, 1);
  return candidate;
}
