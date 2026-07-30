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

const {
  getOrdersForDay,
  getOrdersByDayForWeek,
  getOrdersSummary,
  getDishNamesForDay,
  getDishNamesForWeek,
  getWeekTotalMeals,
  getWeekTotalValue,
  getMonthlyOrderSummary,
} = await import("@/lib/ordersSummary");

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

function dayLine(
  dayIndex: number,
  customerId: string,
  storeName: string,
  letter: string,
  quantity: number,
  isXl = false
) {
  return { dayIndex, ...line(customerId, storeName, letter, quantity, isXl) };
}

describe("getOrdersByDayForWeek", () => {
  it("buckets quantities per weekday and per customer within that day", async () => {
    findManyOrderLine.mockResolvedValue([
      dayLine(0, "c1", "Zöld Bolt", "a", 2),
      dayLine(4, "c1", "Zöld Bolt", "c", 1),
      dayLine(0, "c2", "Alma Büfé", "b", 5),
    ]);

    const result = await getOrdersByDayForWeek("2026-07-06");

    expect(result).toHaveLength(5);
    expect(result[0].totals).toEqual({ ...EMPTY_DAY, a: 2, b: 5 });
    expect(result[0].byCustomer.map((c) => c.storeName)).toEqual(["Alma Büfé", "Zöld Bolt"]);
    expect(result[4].totals).toEqual({ ...EMPTY_DAY, c: 1 });
    expect(result[1].totals).toEqual(EMPTY_DAY);
    expect(result[1].byCustomer).toEqual([]);
  });

  it("returns 5 empty days when nothing was ordered all week", async () => {
    findManyOrderLine.mockResolvedValue([]);

    const result = await getOrdersByDayForWeek("2026-07-06");

    expect(result).toHaveLength(5);
    result.forEach((day) => {
      expect(day.totals).toEqual(EMPTY_DAY);
      expect(day.byCustomer).toEqual([]);
    });
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

describe("getDishNamesForWeek", () => {
  it("returns 5 null entries when no menu exists for that week", async () => {
    findUniqueWeeklyMenu.mockResolvedValue(null);
    expect(await getDishNamesForWeek("2026-07-06")).toEqual([null, null, null, null, null]);
    expect(findUniqueWeeklyMenu).toHaveBeenCalledTimes(1);
  });

  it("returns dish names for each weekday, falling back to A/B/C for blanks", async () => {
    findUniqueWeeklyMenu.mockResolvedValue({
      days: [
        { a: "Csirkemell steak", aGM: false, b: "Mexikói ragu", bGM: false, c: "Toscan penne", cGM: false },
        { a: "", aGM: false, b: "Valami", bGM: false, c: "", cGM: false },
      ],
    });
    const result = await getDishNamesForWeek("2026-07-06");
    expect(result[0]).toEqual({ a: "Csirkemell steak", b: "Mexikói ragu", c: "Toscan penne" });
    expect(result[1]).toEqual({ a: "A", b: "Valami", c: "C" });
    expect(result[2]).toBeNull();
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

describe("getMonthlyOrderSummary", () => {
  it("sums quantities and Ft value per customer across a month, XL priced higher", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        weekStart: new Date("2026-07-06T00:00:00.000Z"),
        customer: { storeName: "Alma Büfé" },
        lines: [
          { dayIndex: 0, letter: "a", quantity: 2, isXl: false }, // 2026-07-06
          { dayIndex: 0, letter: "a", quantity: 1, isXl: true }, // 2026-07-06
        ],
      },
    ]);

    const { byCustomer } = await getMonthlyOrderSummary("2026-07-01", "2026-07-31");
    const [row] = byCustomer;

    expect(row.customerId).toBe("c1");
    expect(row.storeName).toBe("Alma Büfé");
    expect(row.totalMeals).toBe(3);
    expect(row.totalValue).toBe(2 * 1200 + 1 * 1500);
  });

  it("splits each customer's totals into a per-week breakdown", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        weekStart: new Date("2026-07-06T00:00:00.000Z"),
        customer: { storeName: "Alma Büfé" },
        lines: [{ dayIndex: 0, letter: "a", quantity: 2, isXl: false }], // 2026-07-06
      },
      {
        customerId: "c1",
        weekStart: new Date("2026-07-13T00:00:00.000Z"),
        customer: { storeName: "Alma Büfé" },
        lines: [{ dayIndex: 0, letter: "a", quantity: 5, isXl: false }], // 2026-07-13
      },
    ]);

    const { byCustomer } = await getMonthlyOrderSummary("2026-07-01", "2026-07-31");
    const [row] = byCustomer;

    expect(row.byWeek).toContainEqual({ weekStart: "2026-07-06", meals: 2, value: 2 * 1200 });
    expect(row.byWeek).toContainEqual({ weekStart: "2026-07-13", meals: 5, value: 5 * 1200 });
    // Weeks the customer didn't order in still appear, at zero - so every
    // customer row has an entry for every column in the table.
    expect(row.byWeek).toContainEqual({ weekStart: "2026-06-29", meals: 0, value: 0 });
  });

  it("excludes days that fall in a different month, even within a week that's mostly inside it", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        weekStart: new Date("2026-07-27T00:00:00.000Z"), // Mon 07-27 .. Fri 07-31, but Sat/Sun would spill to Aug
        customer: { storeName: "Alma Büfé" },
        lines: [
          { dayIndex: 4, letter: "a", quantity: 5, isXl: false }, // Fri 2026-07-31, inside July
        ],
      },
      {
        customerId: "c1",
        weekStart: new Date("2026-08-03T00:00:00.000Z"), // next week, entirely in August
        customer: { storeName: "Alma Büfé" },
        lines: [{ dayIndex: 0, letter: "a", quantity: 9, isXl: false }],
      },
    ]);

    const { byCustomer } = await getMonthlyOrderSummary("2026-07-01", "2026-07-31");
    const [row] = byCustomer;

    expect(row.totalMeals).toBe(5);
    expect(row.totalValue).toBe(5 * 1200);
  });

  it("sorts by total value descending, ties broken by store name", async () => {
    findManyOrder.mockResolvedValue([
      {
        customerId: "c1",
        weekStart: new Date("2026-07-06T00:00:00.000Z"),
        customer: { storeName: "Zöld Bolt" },
        lines: [{ dayIndex: 0, letter: "a", quantity: 1, isXl: false }],
      },
      {
        customerId: "c2",
        weekStart: new Date("2026-07-06T00:00:00.000Z"),
        customer: { storeName: "Alma Büfé" },
        lines: [{ dayIndex: 0, letter: "a", quantity: 5, isXl: false }],
      },
    ]);

    const { byCustomer } = await getMonthlyOrderSummary("2026-07-01", "2026-07-31");

    expect(byCustomer.map((r) => r.storeName)).toEqual(["Alma Büfé", "Zöld Bolt"]);
  });

  it("queries every weekStart Monday that could overlap the month", async () => {
    findManyOrder.mockResolvedValue([]);
    const { weekStarts } = await getMonthlyOrderSummary("2026-07-01", "2026-07-31");

    // July 2026: 1st is a Wednesday, so the first relevant Monday is 2026-06-29;
    // last Monday whose week can still touch July 31 is 2026-07-27.
    expect(weekStarts).toEqual(["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);

    const arg = findManyOrder.mock.calls[0][0];
    const queriedWeeks = arg.where.weekStart.in.map((d) => d.toISOString().slice(0, 10));
    expect(queriedWeeks).toEqual(weekStarts);
  });

  it("returns an empty customer list when nothing was ordered", async () => {
    findManyOrder.mockResolvedValue([]);
    expect((await getMonthlyOrderSummary("2026-07-01", "2026-07-31")).byCustomer).toEqual([]);
  });
});
