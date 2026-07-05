import { describe, expect, it } from "vitest";
import {
  applyLockedDays,
  daysGridToOrderLines,
  emptyOrderWeek,
  isValidOrderDays,
  orderLinesToDaysGrid,
} from "@/lib/orders";

describe("emptyOrderWeek", () => {
  it("returns 5 zeroed days", () => {
    expect(emptyOrderWeek()).toEqual([
      { a: 0, b: 0, c: 0 },
      { a: 0, b: 0, c: 0 },
      { a: 0, b: 0, c: 0 },
      { a: 0, b: 0, c: 0 },
      { a: 0, b: 0, c: 0 },
    ]);
  });

  it("returns independent day objects", () => {
    const week = emptyOrderWeek();
    week[0].a = 5;
    expect(week[1].a).toBe(0);
  });
});

describe("orderLinesToDaysGrid", () => {
  it("places quantities at the right day/letter and zero-fills the rest", () => {
    const grid = orderLinesToDaysGrid([
      { dayIndex: 0, letter: "a", quantity: 3 },
      { dayIndex: 4, letter: "c", quantity: 7 },
    ]);
    expect(grid[0]).toEqual({ a: 3, b: 0, c: 0 });
    expect(grid[4]).toEqual({ a: 0, b: 0, c: 7 });
    expect(grid[1]).toEqual({ a: 0, b: 0, c: 0 });
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
  it("skips zero-quantity cells", () => {
    const days = orderLinesToDaysGrid([{ dayIndex: 2, letter: "b", quantity: 4 }]);
    expect(daysGridToOrderLines(days)).toEqual([{ dayIndex: 2, letter: "b", quantity: 4 }]);
  });

  it("round-trips through orderLinesToDaysGrid", () => {
    const lines = [
      { dayIndex: 0, letter: "a" as const, quantity: 1 },
      { dayIndex: 0, letter: "b" as const, quantity: 2 },
      { dayIndex: 3, letter: "c" as const, quantity: 9 },
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

  it("rejects negative or non-integer quantities", () => {
    expect(isValidOrderDays([{ a: -1, b: 0, c: 0 }, ...emptyOrderWeek().slice(1)])).toBe(false);
    expect(isValidOrderDays([{ a: 1.5, b: 0, c: 0 }, ...emptyOrderWeek().slice(1)])).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(isValidOrderDays([{ a: 1, b: 0 }, ...emptyOrderWeek().slice(1)])).toBe(false);
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
    expect(result[0]).toEqual({ a: 5, b: 0, c: 0 });
    expect(result[1]).toEqual({ a: 0, b: 2, c: 0 });
  });

  it("applies all submitted values when nothing is locked", () => {
    const existing = emptyOrderWeek();
    const submitted = orderLinesToDaysGrid([{ dayIndex: 2, letter: "c", quantity: 3 }]);
    expect(applyLockedDays(submitted, existing, [])).toEqual(submitted);
  });
});
