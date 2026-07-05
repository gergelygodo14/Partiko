import { describe, expect, it } from "vitest";
import {
  addDaysStr,
  dayRange,
  getActiveOrderWeek,
  getExportDay,
  getLockedDayIndexes,
  mondayOf,
  parseDay,
  rangeBetween,
  toDayStr,
} from "@/lib/dates";

// `hour` is Budapest local time; construct the equivalent UTC instant by
// subtracting the offset (CET=+1 in winter, CEST=+2 in summer).
function budapestInstant(dateStr: string, hour: number, utcOffsetHours: number): Date {
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  return new Date(utcMidnight + hour * 3600_000 - utcOffsetHours * 3600_000);
}

describe("parseDay", () => {
  it("parses a date string as UTC midnight", () => {
    const d = parseDay("2026-07-03");
    expect(d.toISOString()).toBe("2026-07-03T00:00:00.000Z");
  });
});

describe("toDayStr", () => {
  it("formats a Date back to YYYY-MM-DD", () => {
    expect(toDayStr(new Date("2026-07-03T00:00:00.000Z"))).toBe("2026-07-03");
  });
});

describe("dayRange", () => {
  it("returns a [start, nextDay) range", () => {
    const { gte, lt } = dayRange("2026-07-03");
    expect(gte.toISOString()).toBe("2026-07-03T00:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });
});

describe("rangeBetween", () => {
  it("returns an inclusive [from, to] range as [gte, lt)", () => {
    const { gte, lt } = rangeBetween("2026-07-01", "2026-07-03");
    expect(gte.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });
});

describe("addDaysStr", () => {
  it("adds days within a month", () => {
    expect(addDaysStr("2026-07-03", 2)).toBe("2026-07-05");
  });

  it("rolls over a month boundary", () => {
    expect(addDaysStr("2026-07-30", 3)).toBe("2026-08-02");
  });

  it("handles leap-year February", () => {
    expect(addDaysStr("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("handles negative offsets", () => {
    expect(addDaysStr("2026-07-03", -3)).toBe("2026-06-30");
  });
});

describe("mondayOf", () => {
  it("returns the same date when already Monday", () => {
    expect(mondayOf("2026-06-29")).toBe("2026-06-29");
  });

  it("finds Monday for a mid-week date", () => {
    expect(mondayOf("2026-07-03")).toBe("2026-06-29");
  });

  it("finds the prior Monday for a Sunday", () => {
    expect(mondayOf("2026-07-05")).toBe("2026-06-29");
  });
});

describe("getActiveOrderWeek", () => {
  // Week of 2026-06-29 (Mon) - 2026-07-05 (Sun), summer => Budapest is CEST (+2).
  it("Monday morning is the current week", () => {
    const now = budapestInstant("2026-06-29", 0, 2);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-06-29", isCurrentWeek: true });
  });

  it("Wednesday noon is still the current week", () => {
    const now = budapestInstant("2026-07-01", 12, 2);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-06-29", isCurrentWeek: true });
  });

  it("Thursday 09:59 is still the current week (just before cutoff)", () => {
    const now = budapestInstant("2026-07-02", 9, 2);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-06-29", isCurrentWeek: true });
  });

  it("Thursday 10:00 exactly flips to next week", () => {
    const now = budapestInstant("2026-07-02", 10, 2);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-07-06", isCurrentWeek: false });
  });

  it("Thursday 10:01 is next week", () => {
    const now = new Date(budapestInstant("2026-07-02", 10, 2).getTime() + 60_000);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-07-06", isCurrentWeek: false });
  });

  it("Sunday is next week", () => {
    const now = budapestInstant("2026-07-05", 15, 2);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-07-06", isCurrentWeek: false });
  });

  it("winter Thursday before cutoff uses the CET (+1) offset", () => {
    const now = budapestInstant("2026-01-01", 9, 1);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2025-12-29", isCurrentWeek: true });
  });

  it("survives the DST clocks-back transition (day after, CET +1)", () => {
    const now = budapestInstant("2026-10-26", 1, 1);
    expect(getActiveOrderWeek(now)).toEqual({ weekStart: "2026-10-26", isCurrentWeek: true });
  });
});

describe("getExportDay", () => {
  it("Sunday morning exports Monday's orders (kitchen preps Monday's food on Sunday)", () => {
    const now = budapestInstant("2026-07-05", 8, 2);
    expect(getExportDay(now)).toEqual({ date: "2026-07-06", weekStart: "2026-07-06", dayIndex: 0 });
  });

  it("Thursday exports Friday's orders (last meal of the week)", () => {
    const now = budapestInstant("2026-07-02", 8, 2);
    expect(getExportDay(now)).toEqual({ date: "2026-07-03", weekStart: "2026-06-29", dayIndex: 4 });
  });

  it("Wednesday exports Thursday's orders, same week", () => {
    const now = budapestInstant("2026-07-01", 8, 2);
    expect(getExportDay(now)).toEqual({ date: "2026-07-02", weekStart: "2026-06-29", dayIndex: 3 });
  });

  it("Friday exports Saturday, which has no menu day", () => {
    const now = budapestInstant("2026-07-03", 8, 2);
    expect(getExportDay(now)).toEqual({ date: "2026-07-04", weekStart: "2026-06-29", dayIndex: null });
  });

  it("Saturday exports Sunday, which has no menu day", () => {
    const now = budapestInstant("2026-07-04", 8, 2);
    expect(getExportDay(now)).toEqual({ date: "2026-07-05", weekStart: "2026-06-29", dayIndex: null });
  });
});

describe("getLockedDayIndexes", () => {
  it("locks nothing on Monday", () => {
    const active = { weekStart: "2026-06-29", isCurrentWeek: true };
    const now = budapestInstant("2026-06-29", 8, 2);
    expect(getLockedDayIndexes(active, now)).toEqual([]);
  });

  it("locks Monday and Tuesday by Wednesday", () => {
    const active = { weekStart: "2026-06-29", isCurrentWeek: true };
    const now = budapestInstant("2026-07-01", 12, 2);
    expect(getLockedDayIndexes(active, now)).toEqual([0, 1]);
  });

  it("locks Monday-Wednesday just before the Thursday cutoff", () => {
    const active = { weekStart: "2026-06-29", isCurrentWeek: true };
    const now = budapestInstant("2026-07-02", 9, 2);
    expect(getLockedDayIndexes(active, now)).toEqual([0, 1, 2]);
  });

  it("never locks days of a future (next) week", () => {
    const active = { weekStart: "2026-07-06", isCurrentWeek: false };
    const now = budapestInstant("2026-07-06", 12, 2);
    expect(getLockedDayIndexes(active, now)).toEqual([]);
  });
});
