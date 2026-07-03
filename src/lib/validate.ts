import type { MenuDay } from "@/lib/weeklyMenu";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real "YYYY-MM-DD" calendar date (rejects malformed
 * strings and out-of-range values like "2026-13-40" that Date would
 * otherwise silently roll over or turn into an Invalid Date).
 */
export function isValidDateStr(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidMenuDay(value: unknown): value is MenuDay {
  if (typeof value !== "object" || value === null) return false;
  const day = value as Record<string, unknown>;
  return (
    typeof day.a === "string" &&
    typeof day.b === "string" &&
    typeof day.c === "string" &&
    typeof day.aGM === "boolean" &&
    typeof day.bGM === "boolean" &&
    typeof day.cGM === "boolean"
  );
}
