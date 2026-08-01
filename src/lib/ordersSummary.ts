import { prisma } from "@/lib/db";
import { addDaysStr, mondayOf, parseDay, toDayStr } from "@/lib/dates";
import {
  emptyOrderWeek,
  orderLinesToDaysGrid,
  orderValue,
  quantityField,
  MEAL_PRICE_FT,
  MEAL_PRICE_XL_FT,
  MEAL_PROFIT_FT,
  ORDER_QUANTITY_FIELDS,
  type OrderDayQuantities,
  type OrderLetter,
} from "@/lib/orders";
import type { MenuDay } from "@/lib/weeklyMenu";

export type CustomerOrderRow = {
  customerId: string;
  storeName: string;
  companyName: string;
  days: OrderDayQuantities[];
};

export type OrdersSummary = {
  dayTotals: OrderDayQuantities[];
  byCustomer: CustomerOrderRow[];
};

// Sums every quantity field (normal + XL, all letters) for one day's row.
export function dayTotal(day: OrderDayQuantities): number {
  return ORDER_QUANTITY_FIELDS.reduce((sum, field) => sum + day[field], 0);
}

export async function getOrdersSummary(weekStart: string): Promise<OrdersSummary> {
  const orders = await prisma.order.findMany({
    where: { weekStart: parseDay(weekStart) },
    include: { customer: true, lines: true },
  });

  const dayTotals = emptyOrderWeek();
  const byCustomer = orders.map((order) => {
    const days = orderLinesToDaysGrid(order.lines);
    days.forEach((day, i) => {
      ORDER_QUANTITY_FIELDS.forEach((field) => {
        dayTotals[i][field] += day[field];
      });
    });
    return {
      customerId: order.customerId,
      storeName: order.customer.storeName,
      companyName: order.customer.companyName,
      days,
    };
  });
  // Biggest orderer first, not alphabetical - ties broken by name for a
  // stable, predictable order.
  byCustomer.sort((a, b) => {
    const totalA = a.days.reduce((sum, day) => sum + dayTotal(day), 0);
    const totalB = b.days.reduce((sum, day) => sum + dayTotal(day), 0);
    return totalB - totalA || a.storeName.localeCompare(b.storeName, "hu");
  });

  return { dayTotals, byCustomer };
}

export type CustomerDayOrderRow = {
  customerId: string;
  storeName: string;
  companyName: string;
} & OrderDayQuantities;

export type DayOrdersSummary = {
  totals: OrderDayQuantities;
  byCustomer: CustomerDayOrderRow[];
};

export async function getOrdersForDay(weekStart: string, dayIndex: number): Promise<DayOrdersSummary> {
  const lines = await prisma.orderLine.findMany({
    where: { dayIndex, order: { weekStart: parseDay(weekStart) } },
    include: { order: { include: { customer: true } } },
  });

  const totals: OrderDayQuantities = { a: 0, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 };
  const byCustomerMap = new Map<string, CustomerDayOrderRow>();

  for (const line of lines) {
    const { customer } = line.order;
    const field = quantityField(line.letter as OrderLetter, line.isXl);
    if (!byCustomerMap.has(customer.id)) {
      byCustomerMap.set(customer.id, {
        customerId: customer.id,
        storeName: customer.storeName,
        companyName: customer.companyName,
        a: 0,
        b: 0,
        c: 0,
        aXl: 0,
        bXl: 0,
        cXl: 0,
      });
    }
    const row = byCustomerMap.get(customer.id)!;
    row[field] += line.quantity;
    totals[field] += line.quantity;
  }

  // Biggest orderer first, not alphabetical - ties broken by name for a
  // stable, predictable order.
  const byCustomer = Array.from(byCustomerMap.values()).sort(
    (a, b) => dayTotal(b) - dayTotal(a) || a.storeName.localeCompare(b.storeName, "hu")
  );

  return { totals, byCustomer };
}

export type DishNames = { a: string; b: string; c: string };

// Falls back to plain "A"/"B"/"C" labels if the week has no menu entered yet
// (or no dish text for a letter) - keeps the daily kitchen sheet legible
// rather than showing a blank column header.
export async function getDishNamesForDay(
  weekStart: string,
  dayIndex: number | null
): Promise<DishNames | null> {
  if (dayIndex === null) return null;
  const menu = await prisma.weeklyMenu.findUnique({ where: { weekStart: parseDay(weekStart) } });
  const day = (menu?.days as MenuDay[] | undefined)?.[dayIndex];
  if (!day) return null;
  return { a: day.a || "A", b: day.b || "B", c: day.c || "C" };
}

// Same fallback rule as getDishNamesForDay, for all 5 weekdays at once (one
// query instead of five) - used by the day-picker breakdown on /rendelesek.
export async function getDishNamesForWeek(weekStart: string): Promise<(DishNames | null)[]> {
  const menu = await prisma.weeklyMenu.findUnique({ where: { weekStart: parseDay(weekStart) } });
  const menuDays = menu?.days as MenuDay[] | undefined;
  return Array.from({ length: 5 }, (_, i) => {
    const day = menuDays?.[i];
    if (!day) return null;
    return { a: day.a || "A", b: day.b || "B", c: day.c || "C" };
  });
}

// Same per-customer breakdown as getOrdersForDay, for all 5 weekdays at once
// (one query instead of five) - used by the day-picker breakdown on
// /rendelesek so switching days doesn't need a new request.
export async function getOrdersByDayForWeek(weekStart: string): Promise<DayOrdersSummary[]> {
  const lines = await prisma.orderLine.findMany({
    where: { order: { weekStart: parseDay(weekStart) } },
    include: { order: { include: { customer: true } } },
  });

  const totalsByDay: OrderDayQuantities[] = emptyOrderWeek();
  const byCustomerMaps = Array.from({ length: 5 }, () => new Map<string, CustomerDayOrderRow>());

  for (const line of lines) {
    if (line.dayIndex < 0 || line.dayIndex > 4) continue;
    const { customer } = line.order;
    const field = quantityField(line.letter as OrderLetter, line.isXl);
    const map = byCustomerMaps[line.dayIndex];
    if (!map.has(customer.id)) {
      map.set(customer.id, {
        customerId: customer.id,
        storeName: customer.storeName,
        companyName: customer.companyName,
        a: 0,
        b: 0,
        c: 0,
        aXl: 0,
        bXl: 0,
        cXl: 0,
      });
    }
    const row = map.get(customer.id)!;
    row[field] += line.quantity;
    totalsByDay[line.dayIndex][field] += line.quantity;
  }

  return totalsByDay.map((totals, i) => ({
    totals,
    byCustomer: Array.from(byCustomerMaps[i].values()).sort(
      (a, b) => dayTotal(b) - dayTotal(a) || a.storeName.localeCompare(b.storeName, "hu")
    ),
  }));
}

export async function getWeekTotalMeals(weekStart: string): Promise<number> {
  const { dayTotals } = await getOrdersSummary(weekStart);
  return dayTotals.reduce(
    (sum, d) => sum + ORDER_QUANTITY_FIELDS.reduce((daySum, field) => daySum + d[field], 0),
    0
  );
}

export async function getWeekTotalValue(weekStart: string): Promise<number> {
  const { dayTotals } = await getOrdersSummary(weekStart);
  return dayTotals.reduce((sum, d) => sum + orderValue(d), 0);
}

export type CustomerMonthlyWeekRow = { weekStart: string; meals: number; value: number };

export type CustomerMonthlyRow = {
  customerId: string;
  storeName: string;
  totalMeals: number;
  totalValue: number;
  byWeek: CustomerMonthlyWeekRow[];
};

export type MonthlyOrderSummary = {
  weekStarts: string[];
  byCustomer: CustomerMonthlyRow[];
};

// Billing runs calendar-month, 1st through the last day, independent of the
// Monday-based order weeks - a month spans parts of 4-6 different
// `weekStart` weeks, so this pulls every week that could contain a day
// within [monthStart, monthEnd] and then filters line-by-line to the exact
// calendar dates, rather than assuming whole weeks fall inside the month.
// The per-customer `byWeek` split (added for reconciling a customer who pays
// in one lump sum for several weeks at once, e.g. a store paying for a whole
// group) reuses the same in-month date filter, so a week straddling the
// month boundary only counts the days that actually fall in this month -
// consistent with the totals above.
export async function getMonthlyOrderSummary(
  monthStart: string,
  monthEnd: string
): Promise<MonthlyOrderSummary> {
  const weekStarts: string[] = [];
  for (let ws = mondayOf(monthStart); ws <= monthEnd; ws = addDaysStr(ws, 7)) {
    weekStarts.push(ws);
  }

  const orders = await prisma.order.findMany({
    where: { weekStart: { in: weekStarts.map(parseDay) } },
    include: { customer: true, lines: true },
  });

  const byCustomer = new Map<string, CustomerMonthlyRow>();
  for (const order of orders) {
    const weekStartStr = toDayStr(order.weekStart);
    for (const line of order.lines) {
      const date = addDaysStr(weekStartStr, line.dayIndex);
      if (date < monthStart || date > monthEnd) continue;

      if (!byCustomer.has(order.customerId)) {
        byCustomer.set(order.customerId, {
          customerId: order.customerId,
          storeName: order.customer.storeName,
          totalMeals: 0,
          totalValue: 0,
          byWeek: weekStarts.map((weekStart) => ({ weekStart, meals: 0, value: 0 })),
        });
      }
      const row = byCustomer.get(order.customerId)!;
      const value = line.quantity * (line.isXl ? MEAL_PRICE_XL_FT : MEAL_PRICE_FT);
      row.totalMeals += line.quantity;
      row.totalValue += value;
      const weekRow = row.byWeek.find((w) => w.weekStart === weekStartStr)!;
      weekRow.meals += line.quantity;
      weekRow.value += value;
    }
  }

  // Biggest orderer first, not alphabetical - same convention as the weekly
  // and daily breakdowns.
  const sorted = Array.from(byCustomer.values()).sort(
    (a, b) => b.totalValue - a.totalValue || a.storeName.localeCompare(b.storeName, "hu")
  );
  return { weekStarts, byCustomer: sorted };
}

// Total portion count x the flat per-portion profit figure - reuses
// getMonthlyOrderSummary rather than re-querying, since it already sums
// every OrderLine's quantity into totalMeals per customer for this exact
// month range.
export async function getMonthlyMealProfit(
  monthStart: string,
  monthEnd: string
): Promise<{ totalMeals: number; totalProfitFt: number }> {
  const { byCustomer } = await getMonthlyOrderSummary(monthStart, monthEnd);
  const totalMeals = byCustomer.reduce((sum, c) => sum + c.totalMeals, 0);
  return { totalMeals, totalProfitFt: totalMeals * MEAL_PROFIT_FT };
}

export type DishQuantityRow = { name: string; quantity: number };

// Ready meals have no stable per-dish catalog row (unlike SandwichItem) -
// each week's menu is free text in WeeklyMenu.days, so "how much of dish X
// sold" has to be built by resolving each OrderLine's dayIndex+letter
// against that week's menu text and grouping by the resulting name
// (case/whitespace-normalized, since the same dish can be retyped slightly
// differently week to week). Same week-iteration + in-month day filter as
// getMonthlyOrderSummary, but grouped by dish name instead of customer.
export async function getMonthlyDishBreakdown(
  monthStart: string,
  monthEnd: string
): Promise<DishQuantityRow[]> {
  const weekStarts: string[] = [];
  for (let ws = mondayOf(monthStart); ws <= monthEnd; ws = addDaysStr(ws, 7)) {
    weekStarts.push(ws);
  }

  const [orders, menus] = await Promise.all([
    prisma.order.findMany({
      where: { weekStart: { in: weekStarts.map(parseDay) } },
      include: { lines: true },
    }),
    prisma.weeklyMenu.findMany({
      where: { weekStart: { in: weekStarts.map(parseDay) } },
    }),
  ]);

  const menuDaysByWeek = new Map<string, MenuDay[]>();
  for (const menu of menus) {
    menuDaysByWeek.set(toDayStr(menu.weekStart), (menu.days as MenuDay[]) ?? []);
  }

  const quantityByKey = new Map<string, DishQuantityRow>();
  for (const order of orders) {
    const weekStartStr = toDayStr(order.weekStart);
    const menuDays = menuDaysByWeek.get(weekStartStr);
    if (!menuDays) continue;
    for (const line of order.lines) {
      const date = addDaysStr(weekStartStr, line.dayIndex);
      if (date < monthStart || date > monthEnd) continue;
      const day = menuDays[line.dayIndex];
      const rawName = day?.[line.letter as OrderLetter]?.trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      if (!quantityByKey.has(key)) quantityByKey.set(key, { name: rawName, quantity: 0 });
      quantityByKey.get(key)!.quantity += line.quantity;
    }
  }

  return Array.from(quantityByKey.values()).sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "hu")
  );
}

export type DishAverageRow = DishQuantityRow & { aboveAverage: boolean; belowAverage: boolean };

// Pure - split out from getMonthlyDishBreakdown so it's testable without a
// DB mock. "Average" is the mean quantity across every distinct dish name
// that appeared in the period, not a per-catalog-item average (ready meals
// have no fixed catalog), so a month with mostly one-off dishes and a
// handful of repeats will naturally skew the average toward the repeats.
export function computeDishAverageFlags(rows: DishQuantityRow[]): {
  averageQuantity: number;
  rows: DishAverageRow[];
} {
  if (rows.length === 0) return { averageQuantity: 0, rows: [] };
  const total = rows.reduce((sum, r) => sum + r.quantity, 0);
  const averageQuantity = total / rows.length;
  return {
    averageQuantity,
    rows: rows.map((r) => ({
      ...r,
      aboveAverage: r.quantity > averageQuantity,
      belowAverage: r.quantity < averageQuantity,
    })),
  };
}
