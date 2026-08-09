import { describe, expect, it } from "vitest";
import { getSandwichExportDay, getSandwichOrderTargetDay } from "@/lib/sandwichDates";

// `hour` is Budapest local time; construct the equivalent UTC instant by
// subtracting the offset (CET=+1 in winter, CEST=+2 in summer).
function budapestInstant(dateStr: string, hour: number, utcOffsetHours: number): Date {
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  return new Date(utcMidnight + hour * 3600_000 - utcOffsetHours * 3600_000);
}

// Week of 2026-06-29 (Mon) - 2026-07-05 (Sun), summer => Budapest is CEST (+2).
describe("getSandwichOrderTargetDay", () => {
  it("Monday before 14:00 targets Tuesday", () => {
    const now = budapestInstant("2026-06-29", 9, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-06-30", dayName: "Kedd" });
  });

  it("Monday at 14:00 exactly targets Wednesday", () => {
    const now = budapestInstant("2026-06-29", 14, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-01", dayName: "Szerda" });
  });

  it("Monday just before 14:00 still targets Tuesday", () => {
    const now = budapestInstant("2026-06-29", 13, 2);
    const later = new Date(now.getTime() + 59 * 60_000);
    expect(getSandwichOrderTargetDay(later)).toEqual({ date: "2026-06-30", dayName: "Kedd" });
  });

  it("Thursday before 14:00 targets Friday", () => {
    const now = budapestInstant("2026-07-02", 9, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-03", dayName: "Péntek" });
  });

  it("Thursday at/after 14:00 skips the weekend and targets Monday", () => {
    const now = budapestInstant("2026-07-02", 14, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Friday at any time targets next Monday (tomorrow/day-after both land on the weekend)", () => {
    const before = budapestInstant("2026-07-03", 9, 2);
    const after = budapestInstant("2026-07-03", 15, 2);
    expect(getSandwichOrderTargetDay(before)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
    expect(getSandwichOrderTargetDay(after)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Saturday at any time targets Monday", () => {
    const before = budapestInstant("2026-07-04", 9, 2);
    const after = budapestInstant("2026-07-04", 15, 2);
    expect(getSandwichOrderTargetDay(before)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
    expect(getSandwichOrderTargetDay(after)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Sunday before 14:00 targets Monday (whole weekend can order for Monday)", () => {
    const now = budapestInstant("2026-07-05", 9, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Sunday at/after 14:00 targets Tuesday", () => {
    const now = budapestInstant("2026-07-05", 14, 2);
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-07", dayName: "Kedd" });
  });

  it("uses the CET (+1) winter offset correctly", () => {
    const now = budapestInstant("2026-01-05", 9, 1); // Monday, winter
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-01-06", dayName: "Kedd" });
  });
});

describe("getSandwichExportDay", () => {
  it("is always literally tomorrow, with no cutoff-hour jump", () => {
    const before = budapestInstant("2026-06-29", 9, 2); // Monday
    const after = budapestInstant("2026-06-29", 20, 2); // Monday, well past 14:00
    expect(getSandwichExportDay(before)).toEqual({ date: "2026-06-30", dayName: "Kedd" });
    expect(getSandwichExportDay(after)).toEqual({ date: "2026-06-30", dayName: "Kedd" });
  });

  it("stays on the now-finalized 'tomorrow' right after the order cutoff passes", () => {
    // Thursday 14:01: order acceptance has already jumped to Monday, but the
    // kitchen still needs Friday's now-locked list, not an empty Monday one.
    const now = budapestInstant("2026-07-02", 14, 2);
    expect(getSandwichExportDay(now)).toEqual({ date: "2026-07-03", dayName: "Péntek" });
    expect(getSandwichOrderTargetDay(now)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Friday exports Monday (weekend skipped)", () => {
    const now = budapestInstant("2026-07-03", 9, 2);
    expect(getSandwichExportDay(now)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });

  it("Saturday exports Monday (weekend skipped)", () => {
    const now = budapestInstant("2026-07-04", 9, 2);
    expect(getSandwichExportDay(now)).toEqual({ date: "2026-07-06", dayName: "Hétfő" });
  });
});

