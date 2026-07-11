import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyOrderLine = vi.fn();
const findManyOrder = vi.fn();
const findUniqueWeeklyMenu = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    orderLine: { findMany: (...args: unknown[]) => findManyOrderLine(...args) },
    order: { findMany: (...args: unknown[]) => findManyOrder(...args) },
    weeklyMenu: { findUnique: (...args: unknown[]) => findUniqueWeeklyMenu(...args) },
  },
}));

const { getOrdersForDay, getOrdersSummary, getDishNamesForDay, getWeekTotalMeals, getWeekTotalValue } =
  await import("@/lib/ordersSummary");

beforeEach(() => {
  findManyOrderLine.mockReset();
  findManyOrder.mockReset();
  findUniqueWeeklyMenu.mockReset();
});

const EMPTY_DAY = { a: 0, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 };

function line(
  customerId: string,
  storeName: string,
  letter: string,
  quantity: number,
  isXl = false
) {
  return {
    letter,
    quantity,
    isXl,
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

    expect(result.totals).toEqual({ ...EMPTY_DAY, a: 2, b: 5, c: 1 });
    expect(result.byCustomer).toEqual([
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        companyName: "Alma Büfé Kft.",
        ...EMPTY_DAY,
        b: 5,
      },
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        companyName: "Zöld Bolt Kft.",
        ...EMPTY_DAY,
        a: 2,
        c: 1,
      },
    ]);
  });

  it("keeps normal and XL quantities of the same letter separate", async () => {
    findManyOrderLine.mockResolvedValue([
      line("c1", "Zöld Bolt", "a", 2, false),
      line("c1", "Zöld Bolt", "a", 1, true),
    ]);

    const result = await getOrdersForDay("2026-07-06", 0);

    expect(result.totals).toEqual({ ...EMPTY_DAY, a: 2, aXl: 1 });
    expect(result.byCustomer[0]).toMatchObject({ a: 2, aXl: 1 });
  });

  it("sorts by total order quantity, descending, not alphabetically", async () => {
    findManyOrderLine.mockResolvedValue([
      line("c1", "Alma Büfé", "a", 1),
      line("c2", "Zöld Bolt", "b", 9),
    ]);

    const result = await getOrdersForDay("2026-07-06", 4);

    expect(result.byCustomer.map((c) => c.storeName)).toEqual(["Zöld Bolt", "Alma Büfé"]);
  });

  it("breaks ties by store name (Hungarian collation) when quantities are equal", async () => {
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

    expect(result.totals).toEqual(EMPTY_DAY);
    expect(result.byCustomer).toEqual([]);
  });
});

describe("getOrdersSummary", () => {
  it("sorts by total weekly order quantity, descending, not alphabetically", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        customer: { storeName: "Alma Büfé", companyName: "Alma Kft." },
        lines: [{ dayIndex: 0, letter: "a", quantity: 1, isXl: false }],
      },
      {
        customerId: "c2",
        customer: { storeName: "Zöld Bolt", companyName: "Zöld Kft." },
        lines: [
          { dayIndex: 0, letter: "b", quantity: 5, isXl: false },
          { dayIndex: 4, letter: "c", quantity: 4, isXl: false },
        ],
      },
    ]);

    const result = await getOrdersSummary("2026-07-06");

    expect(result.byCustomer.map((c) => c.storeName)).toEqual(["Zöld Bolt", "Alma Büfé"]);
  });
});

describe("getDishNamesForDay", () => {
  it("returns null when the target day is a weekend (no menu day)", async () => {
    expect(await getDishNamesForDay("2026-07-06", null)).toBeNull();
    expect(findUniqueWeeklyMenu).not.toHaveBeenCalled();
  });

  it("returns null when no menu exists for that week", async () => {
    findUniqueWeeklyMenu.mockResolvedValue(null);
    expect(await getDishNamesForDay("2026-07-06", 0)).toBeNull();
  });

  it("returns the dish names for that weekday", async () => {
    findUniqueWeeklyMenu.mockResolvedValue({
      days: [
        { a: "Csirkemell steak", aGM: false, b: "Mexikói ragu", bGM: false, c: "Toscan penne", cGM: false },
      ],
    });
    expect(await getDishNamesForDay("2026-07-06", 0)).toEqual({
      a: "Csirkemell steak",
      b: "Mexikói ragu",
      c: "Toscan penne",
    });
  });

  it("falls back to A/B/C for a blank dish name", async () => {
    findUniqueWeeklyMenu.mockResolvedValue({
      days: [{ a: "", aGM: false, b: "Valami", bGM: false, c: "", cGM: false }],
    });
    expect(await getDishNamesForDay("2026-07-06", 0)).toEqual({ a: "A", b: "Valami", c: "C" });
  });
});

describe("getWeekTotalMeals", () => {
  it("sums normal + XL quantities across all orders and days in the week", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        customer: { storeName: "Alma", companyName: "Alma Kft." },
        lines: [
          { dayIndex: 0, letter: "a", quantity: 2, isXl: false },
          { dayIndex: 0, letter: "a", quantity: 1, isXl: true },
          { dayIndex: 4, letter: "c", quantity: 3, isXl: false },
        ],
      },
    ]);
    expect(await getWeekTotalMeals("2026-07-06")).toBe(6);
  });

  it("returns 0 when nothing was ordered", async () => {
    findManyOrder.mockResolvedValue([]);
    expect(await getWeekTotalMeals("2026-07-06")).toBe(0);
  });
});

describe("getWeekTotalValue", () => {
  it("prices normal portions at 1200 Ft and XL portions at 1500 Ft", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        customer: { storeName: "Alma", companyName: "Alma Kft." },
        lines: [
          { dayIndex: 0, letter: "a", quantity: 2, isXl: false },
          { dayIndex: 0, letter: "a", quantity: 1, isXl: true },
          { dayIndex: 4, letter: "c", quantity: 3, isXl: false },
        ],
      },
    ]);
    expect(await getWeekTotalValue("2026-07-06")).toBe(5 * 1200 + 1 * 1500);
  });

  it("returns 0 when nothing was ordered", async () => {
    findManyOrder.mockResolvedValue([]);
    expect(await getWeekTotalValue("2026-07-06")).toBe(0);
  });
});
