import { describe, expect, it } from "vitest";
import {
  applyLockedDays,
  daysGridToOrderLines,
  emptyOrderWeek,
  formatCell,
  isValidOrderDays,
  orderLinesToDaysGrid,
  orderValue,
} from "@/lib/orders";

const EMPTY_DAY = { a: 0, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 };

describe("emptyOrderWeek", () => {
  it("returns 5 zeroed days (normal + XL fields)", () => {
    expect(emptyOrderWeek()).toEqual([EMPTY_DAY, EMPTY_DAY, EMPTY_DAY, EMPTY_DAY, EMPTY_DAY]);
  });

  it("returns independent day objects", () => {
    const week = emptyOrderWeek();
    week[0].a = 5;
    expect(week[1].a).toBe(0);
  });
});

describe("orderLinesToDaysGrid", () => {
  it("places normal quantities at the right day/letter and zero-fills the rest", () => {
    const grid = orderLinesToDaysGrid([
      { dayIndex: 0, letter: "a", quantity: 3 },
      { dayIndex: 4, letter: "c", quantity: 7 },
    ]);
    expect(grid[0]).toEqual({ ...EMPTY_DAY, a: 3 });
    expect(grid[4]).toEqual({ ...EMPTY_DAY, c: 7 });
    expect(grid[1]).toEqual(EMPTY_DAY);
  });

  it("places XL quantities in the separate aXl/bXl/cXl fields, independent of the normal quantity", () => {
    const grid = orderLinesToDaysGrid([
      { dayIndex: 0, letter: "a", quantity: 2, isXl: false },
      { dayIndex: 0, letter: "a", quantity: 1, isXl: true },
      { dayIndex: 2, letter: "b", quantity: 3, isXl: true },
    ]);
    expect(grid[0]).toEqual({ ...EMPTY_DAY, a: 2, aXl: 1 });
    expect(grid[2]).toEqual({ ...EMPTY_DAY, bXl: 3 });
  });

  it("ignores out-of-range day indexes and unknown letters", () => {
    const grid = orderLinesToDaysGrid([
      { dayIndex: 5, letter: "a", quantity: 1 },
      { dayIndex: -1, letter: "a", quantity: 1 },
      { dayIndex: 0, letter: "d", quantity: 1 },
    ]);
    expect(grid).toEqual(emptyOrderWeek());
  });
});

describe("daysGridToOrderLines", () => {
  it("skips zero-quantity cells (normal and XL)", () => {
    const days = orderLinesToDaysGrid([{ dayIndex: 2, letter: "b", quantity: 4 }]);
    expect(daysGridToOrderLines(days)).toEqual([
      { dayIndex: 2, letter: "b", quantity: 4, isXl: false },
    ]);
  });

  it("emits separate lines for normal and XL quantities of the same letter", () => {
    const days = orderLinesToDaysGrid([
      { dayIndex: 0, letter: "a", quantity: 2, isXl: false },
      { dayIndex: 0, letter: "a", quantity: 1, isXl: true },
    ]);
    expect(daysGridToOrderLines(days)).toEqual([
      { dayIndex: 0, letter: "a", quantity: 2, isXl: false },
      { dayIndex: 0, letter: "a", quantity: 1, isXl: true },
    ]);
  });

  it("round-trips through orderLinesToDaysGrid", () => {
    const lines = [
      { dayIndex: 0, letter: "a" as const, quantity: 1, isXl: false },
      { dayIndex: 0, letter: "b" as const, quantity: 2, isXl: false },
      { dayIndex: 3, letter: "c" as const, quantity: 9, isXl: true },
    ];
    expect(daysGridToOrderLines(orderLinesToDaysGrid(lines))).toEqual(lines);
  });
});

describe("isValidOrderDays", () => {
  it("accepts a well-formed 5-day grid", () => {
    expect(isValidOrderDays(emptyOrderWeek())).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidOrderDays(emptyOrderWeek().slice(0, 4))).toBe(false);
  });

  it("rejects negative or non-integer quantities, including XL fields", () => {
    expect(isValidOrderDays([{ ...EMPTY_DAY, a: -1 }, ...emptyOrderWeek().slice(1)])).toBe(false);
    expect(isValidOrderDays([{ ...EMPTY_DAY, a: 1.5 }, ...emptyOrderWeek().slice(1)])).toBe(false);
    expect(isValidOrderDays([{ ...EMPTY_DAY, aXl: -1 }, ...emptyOrderWeek().slice(1)])).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(isValidOrderDays([{ a: 1, b: 0, c: 0 }, ...emptyOrderWeek().slice(1)])).toBe(false);
  });
});

describe("applyLockedDays", () => {
  it("keeps existing values for locked days and applies submitted values elsewhere", () => {
    const existing = orderLinesToDaysGrid([{ dayIndex: 0, letter: "a", quantity: 5 }]);
    const submitted = orderLinesToDaysGrid([
      { dayIndex: 0, letter: "a", quantity: 99 },
      { dayIndex: 1, letter: "b", quantity: 2 },
    ]);
    const result = applyLockedDays(submitted, existing, [0]);
    expect(result[0]).toEqual({ ...EMPTY_DAY, a: 5 });
    expect(result[1]).toEqual({ ...EMPTY_DAY, b: 2 });
  });

  it("applies all submitted values when nothing is locked", () => {
    const existing = emptyOrderWeek();
    const submitted = orderLinesToDaysGrid([{ dayIndex: 2, letter: "c", quantity: 3 }]);
    expect(applyLockedDays(submitted, existing, [])).toEqual(submitted);
  });
});

describe("orderValue", () => {
  it("prices normal portions at 1200 Ft and XL portions at 1500 Ft", () => {
    expect(orderValue({ a: 2, b: 1, c: 0, aXl: 1, bXl: 0, cXl: 0 })).toBe(3 * 1200 + 1 * 1500);
  });

  it("returns 0 for an empty day", () => {
    expect(orderValue(EMPTY_DAY)).toBe(0);
  });
});

describe("formatCell", () => {
  it("returns an empty string when both are zero", () => {
    expect(formatCell(0, 0)).toBe("");
  });

  it("returns the bare number when there's no XL", () => {
    expect(formatCell(3, 0)).toBe("3");
  });

  it("returns just the XL amount when there's no normal quantity", () => {
    expect(formatCell(0, 2)).toBe("+2 XL");
  });

  it("combines both when there's a mix", () => {
    expect(formatCell(3, 2)).toBe("3 (+2 XL)");
  });
});
