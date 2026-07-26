import { beforeEach, describe, expect, it, vi } from "vitest";

const findManySandwichOrder = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    sandwichOrder: { findMany: (...args: unknown[]) => findManySandwichOrder(...args) },
  },
}));

const {
  getSandwichWeekSummary,
  getSandwichMonthSummary,
  getSandwichOrdersForDay,
  getSandwichCustomerHistory,
} = await import("@/lib/sandwichOrdersSummary");

beforeEach(() => {
  findManySandwichOrder.mockReset();
});

function order(
  customerId: string,
  storeName: string,
  orderDateStr: string,
  lines: { itemId: string; itemName: string; itemOrder?: number; quantity: number; unitPriceFt: number }[]
) {
  return {
    customerId,
    orderDate: new Date(`${orderDateStr}T00:00:00.000Z`),
    customer: { storeName },
    lines: lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitPriceFt: l.unitPriceFt,
      item: { name: l.itemName, order: l.itemOrder ?? 0 },
    })),
  };
}

describe("getSandwichWeekSummary", () => {
  it("aggregates quantity and Ft value by item and by customer", async () => {
    findManySandwichOrder.mockResolvedValue([
      order("c1", "Zöld Bolt", "2026-07-14", [
        { itemId: "hamburger", itemName: "Hamburger", quantity: 2, unitPriceFt: 700 },
      ]),
      order("c2", "Alma Büfé", "2026-07-15", [
        { itemId: "hamburger", itemName: "Hamburger", quantity: 1, unitPriceFt: 700 },
        { itemId: "molnarka", itemName: "Molnárka", quantity: 3, unitPriceFt: 430 },
      ]),
    ]);

    const summary = await getSandwichWeekSummary("2026-07-13");

    expect(summary.weekStart).toBe("2026-07-13");
    expect(summary.weekEnd).toBe("2026-07-17");
    expect(summary.totalQuantity).toBe(6);
    expect(summary.totalValueFt).toBe(2 * 700 + 1 * 700 + 3 * 430);

    // Biggest orderer first.
    expect(summary.byItem[0]).toEqual({
      itemId: "hamburger",
      itemName: "Hamburger",
      quantity: 3,
      valueFt: 2100,
    });
    expect(summary.byCustomer[0]).toEqual({
      customerId: "c2",
      storeName: "Alma Büfé",
      quantity: 4,
      valueFt: 1990,
    });
  });

  it("returns empty totals when nothing was ordered", async () => {
    findManySandwichOrder.mockResolvedValue([]);
    const summary = await getSandwichWeekSummary("2026-07-13");
    expect(summary.byItem).toEqual([]);
    expect(summary.byCustomer).toEqual([]);
    expect(summary.totalQuantity).toBe(0);
    expect(summary.totalValueFt).toBe(0);
  });
});

describe("getSandwichMonthSummary", () => {
  it("aggregates over the given month range", async () => {
    findManySandwichOrder.mockResolvedValue([
      order("c1", "Zöld Bolt", "2026-07-03", [
        { itemId: "hamburger", itemName: "Hamburger", quantity: 4, unitPriceFt: 700 },
      ]),
    ]);
    const summary = await getSandwichMonthSummary("2026-07-01", "2026-07-31");
    expect(summary.totalQuantity).toBe(4);
    expect(summary.totalValueFt).toBe(2800);
  });
});

describe("getSandwichOrdersForDay", () => {
  it("returns one row per store, sorted biggest-orderer-first, item order preserved for pivoting", async () => {
    findManySandwichOrder.mockResolvedValue([
      order("c1", "Zöld Bolt", "2026-07-14", [
        { itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 1 },
      ]),
      order("c2", "Alma Büfé", "2026-07-14", [
        { itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 5 },
        { itemId: "molnarka", itemName: "Molnárka", itemOrder: 2, quantity: 0 },
      ]),
    ]);

    const rows = await getSandwichOrdersForDay("2026-07-14");

    expect(rows[0].storeName).toBe("Alma Büfé");
    expect(rows[0].totalQuantity).toBe(5);
    // Zero-quantity lines are dropped.
    expect(rows[0].lines).toEqual([
      { itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 5 },
    ]);
    expect(rows[1].storeName).toBe("Zöld Bolt");
  });
});

describe("getSandwichCustomerHistory", () => {
  it("returns recent orders newest-first with per-entry totals", async () => {
    findManySandwichOrder.mockResolvedValue([
      order("c1", "Zöld Bolt", "2026-07-14", [
        { itemId: "hamburger", itemName: "Hamburger", quantity: 2, unitPriceFt: 700 },
      ]),
    ]);

    const history = await getSandwichCustomerHistory("c1", 5);

    expect(history).toEqual([
      {
        orderDate: "2026-07-14",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", quantity: 2 }],
        totalQuantity: 2,
        totalValueFt: 1400,
      },
    ]);
    expect(findManySandwichOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: "c1" }, take: 5 })
    );
  });
});
