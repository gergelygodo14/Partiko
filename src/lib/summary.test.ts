import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    entry: { groupBy: (...args: unknown[]) => groupBy(...args) },
    ingredient: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}));

const { getSummary } = await import("@/lib/summary");

beforeEach(() => {
  groupBy.mockReset();
  findMany.mockReset();
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
