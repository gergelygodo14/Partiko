import { describe, expect, it } from "vitest";
import {
  addDaysStr,
  dayRange,
  mondayOf,
  parseDay,
  rangeBetween,
  toDayStr,
} from "@/lib/dates";

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
