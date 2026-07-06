import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import { emptyOrderWeek, orderLinesToDaysGrid, type OrderDayQuantities } from "@/lib/orders";
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

export async function getOrdersSummary(weekStart: string): Promise<OrdersSummary> {
  const orders = await prisma.order.findMany({
    where: { weekStart: parseDay(weekStart) },
    include: { customer: true, lines: true },
  });

  const dayTotals = emptyOrderWeek();
  const byCustomer = orders.map((order) => {
    const days = orderLinesToDaysGrid(order.lines);
    days.forEach((day, i) => {
      dayTotals[i].a += day.a;
      dayTotals[i].b += day.b;
      dayTotals[i].c += day.c;
    });
    return {
      customerId: order.customerId,
      storeName: order.customer.storeName,
      companyName: order.customer.companyName,
      days,
    };
  });
  byCustomer.sort((a, b) => a.storeName.localeCompare(b.storeName, "hu"));

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

  const totals: OrderDayQuantities = { a: 0, b: 0, c: 0 };
  const byCustomerMap = new Map<string, CustomerDayOrderRow>();

  for (const line of lines) {
    const { customer } = line.order;
    const letter = line.letter as keyof OrderDayQuantities;
    if (!byCustomerMap.has(customer.id)) {
      byCustomerMap.set(customer.id, {
        customerId: customer.id,
        storeName: customer.storeName,
        companyName: customer.companyName,
        a: 0,
        b: 0,
        c: 0,
      });
    }
    const row = byCustomerMap.get(customer.id)!;
    row[letter] += line.quantity;
    totals[letter] += line.quantity;
  }

  const byCustomer = Array.from(byCustomerMap.values()).sort((a, b) =>
    a.storeName.localeCompare(b.storeName, "hu")
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

export async function getWeekTotalMeals(weekStart: string): Promise<number> {
  const { dayTotals } = await getOrdersSummary(weekStart);
  return dayTotals.reduce((sum, d) => sum + d.a + d.b + d.c, 0);
}
