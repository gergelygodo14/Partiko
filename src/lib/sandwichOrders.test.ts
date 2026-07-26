import { describe, expect, it } from "vitest";
import {
  buildSandwichOrderLines,
  isValidSandwichOrderItems,
  sandwichOrderTotalCount,
  sandwichOrderValueFt,
} from "@/lib/sandwichOrders";

describe("isValidSandwichOrderItems", () => {
  it("accepts an empty array", () => {
    expect(isValidSandwichOrderItems([])).toBe(true);
  });

  it("accepts a well-formed items array", () => {
    expect(isValidSandwichOrderItems([{ itemId: "i1", quantity: 2 }])).toBe(true);
  });

  it("rejects a non-array", () => {
    expect(isValidSandwichOrderItems({ itemId: "i1", quantity: 2 })).toBe(false);
  });

  it("rejects a missing/empty itemId", () => {
    expect(isValidSandwichOrderItems([{ itemId: "", quantity: 1 }])).toBe(false);
    expect(isValidSandwichOrderItems([{ quantity: 1 }])).toBe(false);
  });

  it("rejects a negative or non-integer quantity", () => {
    expect(isValidSandwichOrderItems([{ itemId: "i1", quantity: -1 }])).toBe(false);
    expect(isValidSandwichOrderItems([{ itemId: "i1", quantity: 1.5 }])).toBe(false);
  });

  it("accepts a zero quantity (used to clear a previously ordered item)", () => {
    expect(isValidSandwichOrderItems([{ itemId: "i1", quantity: 0 }])).toBe(true);
  });
});

describe("buildSandwichOrderLines", () => {
  const prices = new Map([
    ["hamburger", 700],
    ["molnarka", 430],
  ]);

  it("drops zero-quantity items", () => {
    const lines = buildSandwichOrderLines(
      [
        { itemId: "hamburger", quantity: 2 },
        { itemId: "molnarka", quantity: 0 },
      ],
      prices
    );
    expect(lines).toEqual([{ itemId: "hamburger", quantity: 2, unitPriceFt: 700 }]);
  });

  it("drops items not present in the price map (archived/unknown items)", () => {
    const lines = buildSandwichOrderLines([{ itemId: "unknown", quantity: 3 }], prices);
    expect(lines).toEqual([]);
  });

  it("snapshots the current catalog price onto each line", () => {
    const lines = buildSandwichOrderLines([{ itemId: "molnarka", quantity: 5 }], prices);
    expect(lines).toEqual([{ itemId: "molnarka", quantity: 5, unitPriceFt: 430 }]);
  });
});

describe("sandwichOrderValueFt", () => {
  it("sums quantity times unit price across lines", () => {
    const total = sandwichOrderValueFt([
      { quantity: 2, unitPriceFt: 700 },
      { quantity: 1, unitPriceFt: 430 },
    ]);
    expect(total).toBe(1830);
  });

  it("returns 0 for no lines", () => {
    expect(sandwichOrderValueFt([])).toBe(0);
  });
});

describe("sandwichOrderTotalCount", () => {
  it("sums quantities across lines", () => {
    expect(sandwichOrderTotalCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });
});
