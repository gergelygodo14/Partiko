import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyOrderLine = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    orderLine: { findMany: (...args: unknown[]) => findManyOrderLine(...args) },
  },
}));

const { getOrdersForDay } = await import("@/lib/ordersSummary");

beforeEach(() => {
  findManyOrderLine.mockReset();
});

function line(customerId: string, storeName: string, letter: string, quantity: number) {
  return {
    letter,
    quantity,
    order: { customer: { id: customerId, storeName, companyName: `${storeName} Kft.` } },
  };
}

describe("getOrdersForDay", () => {
  it("sums quantities per customer and into a grand total", async () => {
    findManyOrderLine.mockResolvedValue([
      line("c1", "Zöld Bolt", "a", 2),
      line("c1", "Zöld Bolt", "c", 1),
      line("c2", "Alma Büfé", "b", 5),
    ]);

    const result = await getOrdersForDay("2026-07-06", 0);

    expect(result.totals).toEqual({ a: 2, b: 5, c: 1 });
    expect(result.byCustomer).toEqual([
      { customerId: "c2", storeName: "Alma Büfé", companyName: "Alma Büfé Kft.", a: 0, b: 5, c: 0 },
      { customerId: "c1", storeName: "Zöld Bolt", companyName: "Zöld Bolt Kft.", a: 2, b: 0, c: 1 },
    ]);
  });

  it("sorts stores alphabetically (Hungarian collation)", async () => {
    findManyOrderLine.mockResolvedValue([
      line("c2", "Őzike Büfé", "a", 1),
      line("c1", "Alma Büfé", "a", 1),
    ]);

    const result = await getOrdersForDay("2026-07-06", 4);

    expect(result.byCustomer.map((c) => c.storeName)).toEqual(["Alma Büfé", "Őzike Büfé"]);
  });

  it("returns zeroed totals and no customers when nothing was ordered", async () => {
    findManyOrderLine.mockResolvedValue([]);

    const result = await getOrdersForDay("2026-07-06", 2);

    expect(result.totals).toEqual({ a: 0, b: 0, c: 0 });
    expect(result.byCustomer).toEqual([]);
  });
});
