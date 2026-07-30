import { beforeEach, describe, expect, it, vi } from "vitest";

const findManySandwichItem = vi.fn();
const findManySandwichFixOrder = vi.fn();
const findManySandwichOrder = vi.fn();

const txFindUniqueOrder = vi.fn();
const txCreateOrder = vi.fn();
const txDeleteOrder = vi.fn();
const txDeleteManyLines = vi.fn();
const txCreateManyLines = vi.fn();

const tx = {
  sandwichOrder: {
    findUnique: (...args: unknown[]) => txFindUniqueOrder(...args),
    create: (...args: unknown[]) => txCreateOrder(...args),
    delete: (...args: unknown[]) => txDeleteOrder(...args),
  },
  sandwichOrderLine: {
    deleteMany: (...args: unknown[]) => txDeleteManyLines(...args),
    createMany: (...args: unknown[]) => txCreateManyLines(...args),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    sandwichItem: { findMany: (...args: unknown[]) => findManySandwichItem(...args) },
    sandwichFixOrder: { findMany: (...args: unknown[]) => findManySandwichFixOrder(...args) },
    sandwichOrder: { findMany: (...args: unknown[]) => findManySandwichOrder(...args) },
    $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  },
}));

const { getSandwichDayGrid, saveSandwichDayGrid } = await import("@/lib/sandwichDayGrid");

const CATALOG = [
  { id: "i1", name: "Hamburger", order: 4, price: 889, archived: false },
  { id: "i2", name: "Rántott húsos papucs", order: 16, price: 800, archived: false },
];

function customer(id: string, storeName: string, storeGroup = "EGYEB", storeOrder = 1) {
  return { id, storeName, storeGroup, storeOrder };
}

beforeEach(() => {
  for (const mock of [
    findManySandwichItem,
    findManySandwichFixOrder,
    findManySandwichOrder,
    txFindUniqueOrder,
    txCreateOrder,
    txDeleteOrder,
    txDeleteManyLines,
    txCreateManyLines,
  ]) {
    mock.mockReset();
  }
  findManySandwichItem.mockResolvedValue(CATALOG);
  findManySandwichFixOrder.mockResolvedValue([]);
  findManySandwichOrder.mockResolvedValue([]);
  txCreateManyLines.mockResolvedValue({ count: 0 });
  txDeleteManyLines.mockResolvedValue({ count: 0 });
});

describe("getSandwichDayGrid", () => {
  it("rejects a weekend date outright", async () => {
    await expect(getSandwichDayGrid("2026-08-01")).rejects.toThrow("nem hétköznap");
  });

  it("labels items with the kitchen shorthand", async () => {
    const grid = await getSandwichDayGrid("2026-07-30");
    expect(grid.items.map((i) => i.shortLabel)).toEqual(["hamburger", "RHZS PAPUCS"]);
  });

  it("includes stores that are on the weekday's fix round even with no order", async () => {
    findManySandwichFixOrder.mockResolvedValue([
      {
        customerId: "c1",
        customer: customer("c1", "Doma"),
        lines: [{ itemId: "i1", quantity: 3 }],
      },
    ]);
    const grid = await getSandwichDayGrid("2026-07-30");
    expect(grid.stores).toHaveLength(1);
    expect(grid.stores[0]).toMatchObject({ storeName: "Doma", onFixList: true, fix: { i1: 3 } });
    expect(grid.stores[0].saved).toEqual({});
  });

  // A self-service order from a store that is not on this weekday's round must
  // still show up, or the owner would never see it.
  it("includes stores that only have an order, marking them off the fix list", async () => {
    findManySandwichOrder.mockResolvedValue([
      {
        customerId: "c2",
        customer: customer("c2", "Ad hoc"),
        lines: [{ itemId: "i2", quantity: 1 }],
        updatedAt: new Date("2026-07-30T09:00:00.000Z"),
      },
    ]);
    const grid = await getSandwichDayGrid("2026-07-30");
    expect(grid.stores[0]).toMatchObject({ storeName: "Ad hoc", onFixList: false, saved: { i2: 1 } });
  });

  it("reports the newest updatedAt as savedAt", async () => {
    findManySandwichOrder.mockResolvedValue([
      {
        customerId: "c1",
        customer: customer("c1", "A"),
        lines: [],
        updatedAt: new Date("2026-07-30T08:00:00.000Z"),
      },
      {
        customerId: "c2",
        customer: customer("c2", "B"),
        lines: [],
        updatedAt: new Date("2026-07-30T11:00:00.000Z"),
      },
    ]);
    const grid = await getSandwichDayGrid("2026-07-30");
    expect(grid.savedAt).toBe("2026-07-30T11:00:00.000Z");
  });

  it("reports savedAt as null when nothing is stored yet", async () => {
    expect((await getSandwichDayGrid("2026-07-30")).savedAt).toBeNull();
  });

  it("orders stores by group then storeOrder, vidék last", async () => {
    findManySandwichFixOrder.mockResolvedValue([
      { customerId: "v", customer: customer("v", "Határ", "VIDEK", 1), lines: [] },
      { customerId: "e", customer: customer("e", "Doma", "EGYEB", 1), lines: [] },
      { customerId: "f", customer: customer("f", "FAV Mars", "FAV", 2), lines: [] },
    ]);
    const grid = await getSandwichDayGrid("2026-07-30");
    expect(grid.stores.map((s) => s.storeName)).toEqual(["FAV Mars", "Doma", "Határ"]);
  });
});

describe("saveSandwichDayGrid", () => {
  it("creates an order for a store that had none", async () => {
    txFindUniqueOrder.mockResolvedValue(null);
    txCreateOrder.mockResolvedValue({
      id: "o1",
      lines: [],
      customer: { storeName: "Doma" },
    });

    const result = await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "i1", quantity: 2 }] },
    ]);

    expect(txCreateOrder).toHaveBeenCalledOnce();
    expect(txCreateManyLines).toHaveBeenCalledWith({
      data: [{ orderId: "o1", itemId: "i1", quantity: 2, unitPriceFt: 889 }],
    });
    expect(result.createdCount).toBe(1);
    expect(result.changedStoreNames).toEqual(["Doma"]);
  });

  // The price snapshot invariant: unitPriceFt comes from the catalog, never
  // from whatever the client happened to send.
  it("snapshots unitPriceFt from the catalog", async () => {
    txFindUniqueOrder.mockResolvedValue(null);
    txCreateOrder.mockResolvedValue({ id: "o1", lines: [], customer: { storeName: "Doma" } });

    await saveSandwichDayGrid("2026-07-30", [
      {
        customerId: "c1",
        items: [{ itemId: "i2", quantity: 1, unitPriceFt: 1 } as never],
      },
    ]);

    expect(txCreateManyLines).toHaveBeenCalledWith({
      data: [{ orderId: "o1", itemId: "i2", quantity: 1, unitPriceFt: 800 }],
    });
  });

  it("drops unknown or archived itemIds", async () => {
    txFindUniqueOrder.mockResolvedValue(null);
    txCreateOrder.mockResolvedValue({ id: "o1", lines: [], customer: { storeName: "Doma" } });

    await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "ghost", quantity: 5 }, { itemId: "i1", quantity: 1 }] },
    ]);

    expect(txCreateManyLines).toHaveBeenCalledWith({
      data: [{ orderId: "o1", itemId: "i1", quantity: 1, unitPriceFt: 889 }],
    });
  });

  // Clearing a column must look exactly like the order was never entered:
  // a zero-line order would otherwise print as an empty column and show up as
  // a 0-total row in the summaries.
  it("deletes the order when the column is emptied", async () => {
    txFindUniqueOrder.mockResolvedValue({
      id: "o1",
      lines: [{ itemId: "i1", quantity: 2 }],
      customer: { storeName: "Doma" },
    });

    const result = await saveSandwichDayGrid("2026-07-30", [{ customerId: "c1", items: [] }]);

    expect(txDeleteOrder).toHaveBeenCalledWith({ where: { id: "o1" } });
    expect(txCreateOrder).not.toHaveBeenCalled();
    expect(result.deletedCount).toBe(1);
    expect(result.changedStoreNames).toEqual(["Doma"]);
  });

  it("does nothing for an empty column that had no order", async () => {
    txFindUniqueOrder.mockResolvedValue(null);

    const result = await saveSandwichDayGrid("2026-07-30", [{ customerId: "c1", items: [] }]);

    expect(txDeleteOrder).not.toHaveBeenCalled();
    expect(txCreateOrder).not.toHaveBeenCalled();
    expect(txCreateManyLines).not.toHaveBeenCalled();
    expect(result).toMatchObject({ createdCount: 0, deletedCount: 0, changedStoreNames: [] });
  });

  // Re-sending identical data must not churn lines, bump updatedAt, or produce
  // a notification.
  it("is a no-op when the submitted lines match what is stored", async () => {
    txFindUniqueOrder.mockResolvedValue({
      id: "o1",
      lines: [{ itemId: "i1", quantity: 2 }],
      customer: { storeName: "Doma" },
    });

    const result = await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "i1", quantity: 2 }] },
    ]);

    expect(txDeleteManyLines).not.toHaveBeenCalled();
    expect(txCreateManyLines).not.toHaveBeenCalled();
    expect(result.unchangedCount).toBe(1);
    expect(result.changedStoreNames).toEqual([]);
  });

  it("rewrites the lines when a quantity changed", async () => {
    txFindUniqueOrder.mockResolvedValue({
      id: "o1",
      lines: [{ itemId: "i1", quantity: 2 }],
      customer: { storeName: "Doma" },
    });

    const result = await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "i1", quantity: 3 }] },
    ]);

    expect(txDeleteManyLines).toHaveBeenCalledWith({ where: { orderId: "o1" } });
    expect(txCreateManyLines).toHaveBeenCalledWith({
      data: [{ orderId: "o1", itemId: "i1", quantity: 3, unitPriceFt: 889 }],
    });
    expect(result.updatedCount).toBe(1);
  });

  // The guarantee that makes concurrent self-service ordering safe.
  it("never touches a store that was not submitted", async () => {
    txFindUniqueOrder.mockResolvedValue(null);
    txCreateOrder.mockResolvedValue({ id: "o1", lines: [], customer: { storeName: "Doma" } });

    await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "i1", quantity: 1 }] },
    ]);

    expect(txFindUniqueOrder).toHaveBeenCalledOnce();
    expect(txFindUniqueOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId_orderDate: { customerId: "c1", orderDate: expect.any(Date) } },
      })
    );
  });

  it("reports the whole day's totals, not just the saved stores'", async () => {
    txFindUniqueOrder.mockResolvedValue(null);
    txCreateOrder.mockResolvedValue({ id: "o1", lines: [], customer: { storeName: "Doma" } });
    // The post-write re-read returns every order on the date, including one
    // from a store that was never submitted.
    findManySandwichOrder.mockResolvedValue([
      { lines: [{ itemId: "i1", quantity: 2, unitPriceFt: 889 }] },
      { lines: [{ itemId: "i2", quantity: 1, unitPriceFt: 800 }] },
    ]);

    const result = await saveSandwichDayGrid("2026-07-30", [
      { customerId: "c1", items: [{ itemId: "i1", quantity: 2 }] },
    ]);

    expect(result.totalQuantity).toBe(3);
    expect(result.totalValueFt).toBe(2 * 889 + 800);
  });
});
