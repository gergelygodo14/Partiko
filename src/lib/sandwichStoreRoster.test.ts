import { beforeEach, describe, expect, it, vi } from "vitest";

const fixOrderUpsert = vi.fn();
const fixOrderFindMany = vi.fn();
const fixOrderDeleteMany = vi.fn();
const sandwichOrderCount = vi.fn();
const sandwichOrderFindUnique = vi.fn();
const sandwichOrderDeleteMany = vi.fn();
const orderCount = vi.fn();
const customerFindUnique = vi.fn();
const customerDelete = vi.fn();

const client = {
  customer: {
    findUnique: (...args: unknown[]) => customerFindUnique(...args),
    delete: (...args: unknown[]) => customerDelete(...args),
  },
  sandwichFixOrder: {
    upsert: (...args: unknown[]) => fixOrderUpsert(...args),
    findMany: (...args: unknown[]) => fixOrderFindMany(...args),
    deleteMany: (...args: unknown[]) => fixOrderDeleteMany(...args),
  },
  sandwichOrder: {
    count: (...args: unknown[]) => sandwichOrderCount(...args),
    findUnique: (...args: unknown[]) => sandwichOrderFindUnique(...args),
    deleteMany: (...args: unknown[]) => sandwichOrderDeleteMany(...args),
  },
  order: { count: (...args: unknown[]) => orderCount(...args) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    ...client,
    // Both call styles are used: the array form for the independent upserts,
    // the callback form where a read has to decide a write.
    $transaction: async (arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: typeof client) => Promise<unknown>)(client)
        : Promise.all(arg as Promise<unknown>[]),
  },
}));

const {
  addStoreToRounds,
  deleteStoreCompletely,
  getStoreRemovalInfo,
  removeStoreFromRounds,
} = await import("@/lib/sandwichStoreRoster");

beforeEach(() => {
  for (const mock of [
    fixOrderUpsert,
    fixOrderFindMany,
    fixOrderDeleteMany,
    sandwichOrderCount,
    sandwichOrderFindUnique,
    sandwichOrderDeleteMany,
    orderCount,
    customerFindUnique,
    customerDelete,
  ]) {
    mock.mockReset();
  }
  fixOrderUpsert.mockResolvedValue({ id: "fx1" });
  fixOrderFindMany.mockResolvedValue([]);
  fixOrderDeleteMany.mockResolvedValue({ count: 0 });
  sandwichOrderCount.mockResolvedValue(0);
  sandwichOrderFindUnique.mockResolvedValue(null);
  sandwichOrderDeleteMany.mockResolvedValue({ count: 0 });
  orderCount.mockResolvedValue(0);
  customerFindUnique.mockResolvedValue({ id: "c1", storeName: "Új bolt", storeGroup: "EGYEB" });
  customerDelete.mockResolvedValue({ id: "c1" });
});

describe("addStoreToRounds", () => {
  it("marks the store active on each weekday without writing template lines", async () => {
    await addStoreToRounds("c1", [2]);

    expect(fixOrderUpsert).toHaveBeenCalledTimes(1);
    const args = fixOrderUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ customerId_weekday: { customerId: "c1", weekday: 2 } });
    expect(args.update).toEqual({ active: true });
    expect(args.create).toEqual({ customerId: "c1", weekday: 2, active: true });
    // The whole reason this is not saveFixOrdersForWeekday: re-adding a store
    // must not wipe the fix order it is on the round for.
    expect(JSON.stringify(args)).not.toContain("lines");
  });

  it("de-duplicates and sorts the weekdays it reports back", async () => {
    expect(await addStoreToRounds("c1", [4, 0, 4])).toEqual([0, 4]);
    expect(fixOrderUpsert).toHaveBeenCalledTimes(2);
  });

  it("ignores out-of-range weekdays instead of writing them", async () => {
    expect(await addStoreToRounds("c1", [5, -1, 1.5])).toEqual([]);
    expect(fixOrderUpsert).not.toHaveBeenCalled();
  });
});

describe("getStoreRemovalInfo", () => {
  it("reports a store with no orders as deletable", async () => {
    const info = await getStoreRemovalInfo("c1", "2026-08-05");

    expect(info?.deletable).toBe(true);
    expect(info?.hasOrderOnDate).toBe(false);
    expect(info?.quantityOnDate).toBe(0);
  });

  it("is not deletable when only a ready-meal order exists", async () => {
    // The customer row is shared with the ready-meal side, so its orders have
    // to block the delete just as sandwich ones do.
    orderCount.mockResolvedValue(3);

    const info = await getStoreRemovalInfo("c1", "2026-08-05");

    expect(info?.deletable).toBe(false);
    expect(info?.readyMealOrderCount).toBe(3);
  });

  it("sums the quantity that removal would take with it", async () => {
    sandwichOrderFindUnique.mockResolvedValue({ lines: [{ quantity: 4 }, { quantity: 8 }] });
    sandwichOrderCount.mockResolvedValue(1);

    const info = await getStoreRemovalInfo("c1", "2026-08-05");

    expect(info?.hasOrderOnDate).toBe(true);
    expect(info?.quantityOnDate).toBe(12);
    expect(info?.deletable).toBe(false);
  });

  it("lists the round weekdays in order", async () => {
    fixOrderFindMany.mockResolvedValue([{ weekday: 3 }, { weekday: 0 }]);

    expect((await getStoreRemovalInfo("c1", null))?.roundWeekdays).toEqual([0, 3]);
  });

  it("skips the date lookup entirely when no date is given", async () => {
    await getStoreRemovalInfo("c1", null);
    expect(sandwichOrderFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for an unknown store", async () => {
    customerFindUnique.mockResolvedValue(null);
    expect(await getStoreRemovalInfo("nope", "2026-08-05")).toBeNull();
  });
});

describe("removeStoreFromRounds", () => {
  it("removes only the listed weekdays and deletes that date's order", async () => {
    sandwichOrderDeleteMany.mockResolvedValue({ count: 1 });

    const result = await removeStoreFromRounds("c1", [2], "2026-08-05");

    expect(fixOrderDeleteMany).toHaveBeenCalledWith({
      where: { customerId: "c1", weekday: { in: [2] } },
    });
    // Without this the column would come straight back on reload: the day grid
    // includes any store that has an order, round membership or not.
    expect(sandwichOrderDeleteMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ removedWeekdays: [2], deletedOrder: true });
  });

  it("reports deletedOrder false when there was nothing on that date", async () => {
    const result = await removeStoreFromRounds("c1", [0, 1], "2026-08-05");
    expect(result).toEqual({ removedWeekdays: [0, 1], deletedOrder: false });
  });

  it("never touches orders when no date is given", async () => {
    await removeStoreFromRounds("c1", [0], null);
    expect(fixOrderDeleteMany).toHaveBeenCalled();
    expect(sandwichOrderDeleteMany).not.toHaveBeenCalled();
  });
});

describe("deleteStoreCompletely", () => {
  it("deletes fix orders and then the customer when nothing references it", async () => {
    const result = await deleteStoreCompletely("c1");

    expect(result).toEqual({ deleted: true });
    expect(fixOrderDeleteMany).toHaveBeenCalledWith({ where: { customerId: "c1" } });
    expect(customerDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("refuses and explains when the store has orders", async () => {
    sandwichOrderCount.mockResolvedValue(2);
    orderCount.mockResolvedValue(1);

    const result = await deleteStoreCompletely("c1");

    expect(result.deleted).toBe(false);
    expect(result.reason).toContain("3");
    expect(customerDelete).not.toHaveBeenCalled();
    // Crucially the fix orders survive too - a refused delete must change nothing.
    expect(fixOrderDeleteMany).not.toHaveBeenCalled();
  });

  it("refuses for an unknown customer", async () => {
    customerFindUnique.mockResolvedValue(null);

    const result = await deleteStoreCompletely("nope");

    expect(result.deleted).toBe(false);
    expect(customerDelete).not.toHaveBeenCalled();
  });
});
