import { describe, expect, it } from "vitest";
import {
  dateForWeekday,
  defaultEntryDate,
  FULL_DAY_NAMES,
  isDeliveryWeekday,
  SHORT_DAY_NAMES,
  WEEKDAY_COUNT,
  weekdayIndexOf,
} from "@/lib/weekdays";

// 2026-07-27 is a Monday, so 07-27..07-31 is Mon..Fri and 08-01/08-02 the weekend.
const MONDAY = "2026-07-27";

describe("day name tables", () => {
  it("are Mon-Fri only and the same length", () => {
    expect(SHORT_DAY_NAMES).toEqual(["H", "K", "Sze", "Cs", "P"]);
    expect(FULL_DAY_NAMES).toEqual(["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"]);
    expect(SHORT_DAY_NAMES).toHaveLength(WEEKDAY_COUNT);
    expect(FULL_DAY_NAMES).toHaveLength(WEEKDAY_COUNT);
  });
});

describe("weekdayIndexOf", () => {
  it("maps Monday to 0 and Friday to 4", () => {
    expect(weekdayIndexOf("2026-07-27")).toBe(0);
    expect(weekdayIndexOf("2026-07-28")).toBe(1);
    expect(weekdayIndexOf("2026-07-29")).toBe(2);
    expect(weekdayIndexOf("2026-07-30")).toBe(3);
    expect(weekdayIndexOf("2026-07-31")).toBe(4);
  });

  it("returns null for the weekend (no delivery day)", () => {
    expect(weekdayIndexOf("2026-08-01")).toBeNull(); // Saturday
    expect(weekdayIndexOf("2026-08-02")).toBeNull(); // Sunday
  });
});

describe("dateForWeekday", () => {
  it("is the inverse of weekdayIndexOf within a week", () => {
    for (let i = 0; i < WEEKDAY_COUNT; i++) {
      expect(weekdayIndexOf(dateForWeekday(MONDAY, i))).toBe(i);
    }
  });

  it("resolves each weekday of the week", () => {
    expect(dateForWeekday(MONDAY, 0)).toBe("2026-07-27");
    expect(dateForWeekday(MONDAY, 4)).toBe("2026-07-31");
  });
});

describe("isDeliveryWeekday", () => {
  it("accepts weekdays and rejects the weekend", () => {
    expect(isDeliveryWeekday("2026-07-30")).toBe(true);
    expect(isDeliveryWeekday("2026-08-01")).toBe(false);
  });
});

describe("defaultEntryDate", () => {
  it("keeps a weekday as-is", () => {
    expect(defaultEntryDate("2026-07-30")).toBe("2026-07-30");
  });

  // A weekend visit must not land on a date no summary/export can read; it
  // rolls forward to the next orderable day instead.
  it("rolls a Saturday forward to the coming Monday", () => {
    expect(defaultEntryDate("2026-08-01")).toBe("2026-08-03");
  });

  // mondayOf() maps Sunday back to the Monday that started that same week, so
  // +7 from there is the *next* Monday - this is the case a naive
  // "mondayOf(today)" would get wrong by a full week.
  it("rolls a Sunday forward to the coming Monday", () => {
    expect(defaultEntryDate("2026-08-02")).toBe("2026-08-03");
  });
});
