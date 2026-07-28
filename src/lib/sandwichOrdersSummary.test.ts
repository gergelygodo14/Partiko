import { beforeEach, describe, expect, it, vi } from "vitest";

const findManySandwichOrder = vi.fn();
const findManySandwichItem = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    sandwichOrder: { findMany: (...args: unknown[]) => findManySandwichOrder(...args) },
    sandwichItem: { findMany: (...args: unknown[]) => findManySandwichItem(...args) },
  },
}));

const {
  getSandwichWeekSummary,
  getSandwichMonthSummary,
  getSandwichOrdersForDay,
  getSandwichCustomerHistory,
  getSandwichItemTotalsForDay,
  getSandwichWeekDailyItemTotals,
} = await import("@/lib/sandwichOrdersSummary");

beforeEach(() => {
  findManySandwichOrder.mockReset();
  findManySandwichItem.mockReset();
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

describe("getSandwichItemTotalsForDay", () => {
  it("includes every active catalog item, defaulting to 0 when not ordered that day", async () => {
    findManySandwichItem.mockResolvedValue([
      { id: "i1", name: "Sonkás bagel", order: 1 },
      { id: "i2", name: "Hamburger", order: 4 },
    ]);
    findManySandwichOrder.mockResolvedValue([
      {
        lines: [{ itemId: "i1", quantity: 5 }],
      },
    ]);

    const totals = await getSandwichItemTotalsForDay("2026-07-28");

    expect(totals).toEqual([
      { itemId: "i1", itemName: "Sonkás bagel", itemOrder: 1, quantity: 5 },
      { itemId: "i2", itemName: "Hamburger", itemOrder: 4, quantity: 0 },
    ]);
  });

  it("sums quantities across multiple orders for the same item", async () => {
    findManySandwichItem.mockResolvedValue([{ id: "i1", name: "Hamburger", order: 4 }]);
    findManySandwichOrder.mockResolvedValue([
      { lines: [{ itemId: "i1", quantity: 2 }] },
      { lines: [{ itemId: "i1", quantity: 3 }] },
    ]);

    const totals = await getSandwichItemTotalsForDay("2026-07-28");
    expect(totals[0].quantity).toBe(5);
  });
});

describe("getSandwichWeekDailyItemTotals", () => {
  it("returns 5 weekdays (Mon-Fri), each with the full catalog, quantities placed on the right day", async () => {
    findManySandwichItem.mockResolvedValue([
      { id: "i1", name: "Sonkás bagel", order: 1 },
      { id: "i2", name: "Hamburger", order: 4 },
    ]);
    findManySandwichOrder.mockResolvedValue([
      { orderDate: new Date("2026-07-27T00:00:00.000Z"), lines: [{ itemId: "i1", quantity: 5 }] }, // Monday
      { orderDate: new Date("2026-07-29T00:00:00.000Z"), lines: [{ itemId: "i2", quantity: 3 }] }, // Wednesday
    ]);

    const days = await getSandwichWeekDailyItemTotals("2026-07-27");

    expect(days).toHaveLength(5);
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
    ]);
    expect(days[0].items).toEqual([
      { itemId: "i1", itemName: "Sonkás bagel", itemOrder: 1, quantity: 5 },
      { itemId: "i2", itemName: "Hamburger", itemOrder: 4, quantity: 0 },
    ]);
    expect(days[1].items).toEqual([
      { itemId: "i1", itemName: "Sonkás bagel", itemOrder: 1, quantity: 0 },
      { itemId: "i2", itemName: "Hamburger", itemOrder: 4, quantity: 0 },
    ]);
    expect(days[2].items).toEqual([
      { itemId: "i1", itemName: "Sonkás bagel", itemOrder: 1, quantity: 0 },
      { itemId: "i2", itemName: "Hamburger", itemOrder: 4, quantity: 3 },
    ]);
  });

  it("sums multiple same-day orders for the same item onto one day", async () => {
    findManySandwichItem.mockResolvedValue([{ id: "i1", name: "Hamburger", order: 4 }]);
    findManySandwichOrder.mockResolvedValue([
      { orderDate: new Date("2026-07-27T00:00:00.000Z"), lines: [{ itemId: "i1", quantity: 2 }] },
      { orderDate: new Date("2026-07-27T00:00:00.000Z"), lines: [{ itemId: "i1", quantity: 4 }] },
    ]);

    const days = await getSandwichWeekDailyItemTotals("2026-07-27");
    expect(days[0].items[0].quantity).toBe(6);
  });

  it("returns all-zero days when nothing was ordered that week", async () => {
    findManySandwichItem.mockResolvedValue([{ id: "i1", name: "Hamburger", order: 4 }]);
    findManySandwichOrder.mockResolvedValue([]);

    const days = await getSandwichWeekDailyItemTotals("2026-07-27");
    expect(days.every((d) => d.items.every((i) => i.quantity === 0))).toBe(true);
  });
});
