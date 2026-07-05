import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import { emptyOrderWeek, orderLinesToDaysGrid, type OrderDayQuantities } from "@/lib/orders";

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
