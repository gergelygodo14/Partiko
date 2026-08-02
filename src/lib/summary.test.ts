import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
const findMany = vi.fn();
const findManyBillingPeriod = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    entry: { groupBy: (...args: unknown[]) => groupBy(...args) },
    ingredient: { findMany: (...args: unknown[]) => findMany(...args) },
    billingPeriod: { findMany: (...args: unknown[]) => findManyBillingPeriod(...args) },
  },
}));

const { getSummary, getBilledIngredientTotals } = await import("@/lib/summary");

beforeEach(() => {
  groupBy.mockReset();
  findMany.mockReset();
  findManyBillingPeriod.mockReset();
});

describe("getSummary", () => {
  it("joins grouped quantities with ingredient details, sorted by order", async () => {
    groupBy.mockResolvedValue([
      { ingredientId: "i2", _sum: { quantity: 3 } },
      { ingredientId: "i1", _sum: { quantity: 10 } },
    ]);
    findMany.mockResolvedValue([
      { id: "i1", name: "Csirkemell", unit: "kg", unitPrice: 2000, order: 1 },
      { id: "i2", name: "Fasírt", unit: "db", unitPrice: 500, order: 2 },
    ]);

    const result = await getSummary("2026-07-01", "2026-07-03");

    expect(result.rows).toEqual([
      {
        ingredientId: "i1",
        name: "Csirkemell",
        unit: "kg",
        unitPrice: 2000,
        order: 1,
        totalQuantity: 10,
        totalValue: 20000,
      },
      {
        ingredientId: "i2",
        name: "Fasírt",
        unit: "db",
        unitPrice: 500,
        order: 2,
        totalQuantity: 3,
        totalValue: 1500,
      },
    ]);
    expect(result.grandTotal).toBe(21500);
  });

  it("skips groups whose ingredient no longer exists", async () => {
    groupBy.mockResolvedValue([{ ingredientId: "gone", _sum: { quantity: 5 } }]);
    findMany.mockResolvedValue([]);

    const result = await getSummary("2026-07-01", "2026-07-01");

    expect(result.rows).toEqual([]);
    expect(result.grandTotal).toBe(0);
  });

  it("treats a null summed quantity as zero", async () => {
    groupBy.mockResolvedValue([{ ingredientId: "i1", _sum: { quantity: null } }]);
    findMany.mockResolvedValue([
      { id: "i1", name: "Csirkemell", unit: "kg", unitPrice: 2000, order: 1 },
    ]);

    const result = await getSummary("2026-07-01", "2026-07-01");

    expect(result.rows[0].totalQuantity).toBe(0);
    expect(result.rows[0].totalValue).toBe(0);
  });

  it("returns an empty result when nothing was entered", async () => {
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);

    const result = await getSummary("2026-07-01", "2026-07-01");

    expect(result.rows).toEqual([]);
    expect(result.grandTotal).toBe(0);
  });
});

describe("getBilledIngredientTotals", () => {
  it("sums entries from a billing period's own date range, not the report month's", async () => {
    // Billed (closedAt) in August, but the period itself covers July usage -
    // billing lags behind usage, this must still count as August turnover.
    findManyBillingPeriod.mockResolvedValue([
      { id: "p1", from: new Date("2026-07-01T00:00:00.000Z"), to: new Date("2026-07-31T00:00:00.000Z"), closedAt: new Date("2026-08-02T00:00:00.000Z") },
    ]);
    groupBy.mockResolvedValue([{ ingredientId: "i1", _sum: { quantity: 10 } }]);
    findMany.mockResolvedValue([
      { id: "i1", name: "Csirkemell", unit: "kg", unitPrice: 2000, order: 1 },
    ]);

    const result = await getBilledIngredientTotals("2026-08-01", "2026-08-31");

    expect(result.rows).toEqual([
      { ingredientId: "i1", name: "Csirkemell", unit: "kg", unitPrice: 2000, order: 1, totalQuantity: 10, totalValue: 20000 },
    ]);
    expect(result.grandTotal).toBe(20000);
    // Queried the period's own from/to, not the report month.
    const entryQuery = groupBy.mock.calls[0][0];
    expect(entryQuery.where.date.gte.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("sums across multiple billing periods closed within the same month", async () => {
    findManyBillingPeriod.mockResolvedValue([
      { id: "p1", from: new Date("2026-07-01T00:00:00.000Z"), to: new Date("2026-07-15T00:00:00.000Z"), closedAt: new Date("2026-08-01T00:00:00.000Z") },
      { id: "p2", from: new Date("2026-07-16T00:00:00.000Z"), to: new Date("2026-07-31T00:00:00.000Z"), closedAt: new Date("2026-08-15T00:00:00.000Z") },
    ]);
    groupBy
      .mockResolvedValueOnce([{ ingredientId: "i1", _sum: { quantity: 4 } }])
      .mockResolvedValueOnce([{ ingredientId: "i1", _sum: { quantity: 6 } }]);
    findMany.mockResolvedValue([
      { id: "i1", name: "Csirkemell", unit: "kg", unitPrice: 2000, order: 1 },
    ]);

    const result = await getBilledIngredientTotals("2026-08-01", "2026-08-31");
    expect(result.rows[0].totalQuantity).toBe(10);
    expect(result.rows[0].totalValue).toBe(20000);
  });

  it("returns empty without querying entries when no billing period closed that month", async () => {
    findManyBillingPeriod.mockResolvedValue([]);

    const result = await getBilledIngredientTotals("2026-08-01", "2026-08-31");

    expect(result).toEqual({ rows: [], grandTotal: 0 });
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("skips groups whose ingredient no longer exists", async () => {
    findManyBillingPeriod.mockResolvedValue([
      { id: "p1", from: new Date("2026-07-01T00:00:00.000Z"), to: new Date("2026-07-31T00:00:00.000Z"), closedAt: new Date("2026-08-01T00:00:00.000Z") },
    ]);
    groupBy.mockResolvedValue([{ ingredientId: "gone", _sum: { quantity: 5 } }]);
    findMany.mockResolvedValue([]);

    const result = await getBilledIngredientTotals("2026-08-01", "2026-08-31");
    expect(result).toEqual({ rows: [], grandTotal: 0 });
  });
});
