import { prisma } from "@/lib/db";
import { addDaysStr, parseDay, rangeBetween, toDayStr } from "@/lib/dates";
import { sandwichOrderTotalCount, sandwichOrderValueFt } from "@/lib/sandwichOrders";

export type SandwichItemTotal = { itemId: string; itemName: string; quantity: number; valueFt: number };
export type SandwichCustomerTotal = { customerId: string; storeName: string; quantity: number; valueFt: number };

export type SandwichPeriodSummary = {
  byItem: SandwichItemTotal[];
  byCustomer: SandwichCustomerTotal[];
  totalQuantity: number;
  totalValueFt: number;
};

async function summarizeSandwichOrders(fromStr: string, toStr: string): Promise<SandwichPeriodSummary> {
  const { gte, lt } = rangeBetween(fromStr, toStr);
  const orders = await prisma.sandwichOrder.findMany({
    where: { orderDate: { gte, lt } },
    include: { customer: true, lines: { include: { item: true } } },
  });

  const itemMap = new Map<string, SandwichItemTotal>();
  const customerMap = new Map<string, SandwichCustomerTotal>();
  let totalQuantity = 0;
  let totalValueFt = 0;

  for (const order of orders) {
    for (const line of order.lines) {
      if (line.quantity <= 0) continue;
      const lineValue = line.quantity * line.unitPriceFt;
      totalQuantity += line.quantity;
      totalValueFt += lineValue;

      if (!itemMap.has(line.itemId)) {
        itemMap.set(line.itemId, { itemId: line.itemId, itemName: line.item.name, quantity: 0, valueFt: 0 });
      }
      const itemRow = itemMap.get(line.itemId)!;
      itemRow.quantity += line.quantity;
      itemRow.valueFt += lineValue;

      if (!customerMap.has(order.customerId)) {
        customerMap.set(order.customerId, {
          customerId: order.customerId,
          storeName: order.customer.storeName,
          quantity: 0,
          valueFt: 0,
        });
      }
      const customerRow = customerMap.get(order.customerId)!;
      customerRow.quantity += line.quantity;
      customerRow.valueFt += lineValue;
    }
  }

  // Biggest first, not alphabetical - same convention as the ready-meal
  // summaries, ties broken by name.
  const byItem = Array.from(itemMap.values()).sort(
    (a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName, "hu")
  );
  const byCustomer = Array.from(customerMap.values()).sort(
    (a, b) => b.quantity - a.quantity || a.storeName.localeCompare(b.storeName, "hu")
  );

  return { byItem, byCustomer, totalQuantity, totalValueFt };
}

export type SandwichWeekSummary = SandwichPeriodSummary & { weekStart: string; weekEnd: string };

// "Week" here means Monday-Friday (no weekend delivery), mirroring the
// ready-meal weekStart convention, even though SandwichOrder.orderDate is a
// plain calendar date with no weekStart field of its own.
export async function getSandwichWeekSummary(weekStart: string): Promise<SandwichWeekSummary> {
  const weekEnd = addDaysStr(weekStart, 4);
  const summary = await summarizeSandwichOrders(weekStart, weekEnd);
  return { weekStart, weekEnd, ...summary };
}

export async function getSandwichMonthSummary(monthStart: string, monthEnd: string): Promise<SandwichPeriodSummary> {
  return summarizeSandwichOrders(monthStart, monthEnd);
}

export type SandwichDayCustomerOrder = {
  customerId: string;
  storeName: string;
  lines: { itemId: string; itemName: string; itemOrder: number; quantity: number }[];
  totalQuantity: number;
};

// One row per store that ordered on `date`, only nonzero lines, sorted
// biggest-orderer-first - source data for the rotated kitchen xlsx export.
export async function getSandwichOrdersForDay(date: string): Promise<SandwichDayCustomerOrder[]> {
  const orders = await prisma.sandwichOrder.findMany({
    where: { orderDate: parseDay(date) },
    include: { customer: true, lines: { include: { item: true } } },
  });

  const rows = orders.map((order) => {
    const lines = order.lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.item.name,
        itemOrder: line.item.order,
        quantity: line.quantity,
      }));
    return {
      customerId: order.customerId,
      storeName: order.customer.storeName,
      lines,
      totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    };
  });

  return rows.sort((a, b) => b.totalQuantity - a.totalQuantity || a.storeName.localeCompare(b.storeName, "hu"));
}

export type SandwichCatalogItem = { itemId: string; itemName: string; itemOrder: number };

// Every active catalog item, sorted for print/display - shared by anything
// that needs to list the full sandwich lineup regardless of what was
// actually ordered (the kitchen export, the daily summary export).
export async function getActiveSandwichCatalog(): Promise<SandwichCatalogItem[]> {
  const catalog = await prisma.sandwichItem.findMany({
    where: { archived: false },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return catalog.map((item) => ({ itemId: item.id, itemName: item.name, itemOrder: item.order }));
}

export type SandwichDailyItemTotal = SandwichCatalogItem & { quantity: number };

// Every active catalog item (including ones with 0 that day, unlike
// getSandwichOrdersForDay's "only nonzero" convention) - matches the
// reference sheet's own daily-summary tab, which lists the full catalog
// with a literal 0 for anything not ordered, source data for
// generateSandwichDailySummaryXlsx.
export async function getSandwichItemTotalsForDay(date: string): Promise<SandwichDailyItemTotal[]> {
  const [catalog, orders] = await Promise.all([
    getActiveSandwichCatalog(),
    prisma.sandwichOrder.findMany({ where: { orderDate: parseDay(date) }, include: { lines: true } }),
  ]);

  const quantityByItemId = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.lines) {
      quantityByItemId.set(line.itemId, (quantityByItemId.get(line.itemId) ?? 0) + line.quantity);
    }
  }

  return catalog.map((item) => ({
    ...item,
    quantity: quantityByItemId.get(item.itemId) ?? 0,
  }));
}

export type SandwichDayItemTotals = { date: string; items: SandwichDailyItemTotal[] };

// Per-weekday (Mon-Fri) item totals for a given week - lets the owner look
// back at e.g. "last Wednesday" to gauge how much bakery bread to order for
// this Wednesday, which the week/month aggregate views can't answer since
// they collapse every weekday of the period into one number.
export async function getSandwichWeekDailyItemTotals(weekStart: string): Promise<SandwichDayItemTotals[]> {
  const weekEndExclusive = addDaysStr(weekStart, 5); // Saturday, exclusive upper bound
  const [catalog, orders] = await Promise.all([
    getActiveSandwichCatalog(),
    prisma.sandwichOrder.findMany({
      where: { orderDate: { gte: parseDay(weekStart), lt: parseDay(weekEndExclusive) } },
      include: { lines: true },
    }),
  ]);

  const quantityByDay = new Map<string, Map<string, number>>();
  for (const order of orders) {
    const dayStr = toDayStr(order.orderDate);
    if (!quantityByDay.has(dayStr)) quantityByDay.set(dayStr, new Map());
    const dayMap = quantityByDay.get(dayStr)!;
    for (const line of order.lines) {
      dayMap.set(line.itemId, (dayMap.get(line.itemId) ?? 0) + line.quantity);
    }
  }

  return [0, 1, 2, 3, 4].map((offset) => {
    const date = addDaysStr(weekStart, offset);
    const dayMap = quantityByDay.get(date);
    return {
      date,
      items: catalog.map((item) => ({ ...item, quantity: dayMap?.get(item.itemId) ?? 0 })),
    };
  });
}

export type SandwichMonthlyItemBreakdown = SandwichCatalogItem & {
  totalQuantity: number;
  byDate: Record<string, number>;
};

// Item x business-day matrix for a whole calendar month - mirrors the "havi
// július" tab in the owner's own reference workbook (rendelések.xlsx):
// sandwiches down the rows, one column per weekday of the month, so the
// owner can see at a glance how a given item's daily volume moved across the
// month. Weekend dates are skipped entirely since no ordering happens then.
export async function getSandwichMonthDailyItemTotals(
  monthStart: string,
  monthEnd: string
): Promise<{ businessDays: string[]; items: SandwichMonthlyItemBreakdown[] }> {
  const [catalog, orders] = await Promise.all([
    getActiveSandwichCatalog(),
    prisma.sandwichOrder.findMany({
      where: { orderDate: { gte: parseDay(monthStart), lt: parseDay(addDaysStr(monthEnd, 1)) } },
      include: { lines: true },
    }),
  ]);

  const businessDays: string[] = [];
  for (let day = monthStart; day <= monthEnd; day = addDaysStr(day, 1)) {
    const weekday = parseDay(day).getUTCDay(); // 0=Sun..6=Sat
    if (weekday >= 1 && weekday <= 5) businessDays.push(day);
  }

  const quantityByItemAndDay = new Map<string, Map<string, number>>();
  for (const order of orders) {
    const dayStr = toDayStr(order.orderDate);
    for (const line of order.lines) {
      if (!quantityByItemAndDay.has(line.itemId)) quantityByItemAndDay.set(line.itemId, new Map());
      const dayMap = quantityByItemAndDay.get(line.itemId)!;
      dayMap.set(dayStr, (dayMap.get(dayStr) ?? 0) + line.quantity);
    }
  }

  const items = catalog.map((item) => {
    const dayMap = quantityByItemAndDay.get(item.itemId);
    const byDate: Record<string, number> = {};
    let totalQuantity = 0;
    for (const day of businessDays) {
      const qty = dayMap?.get(day) ?? 0;
      byDate[day] = qty;
      totalQuantity += qty;
    }
    return { ...item, totalQuantity, byDate };
  });

  return { businessDays, items };
}

export type SandwichHistoryEntry = {
  orderDate: string;
  lines: { itemId: string; itemName: string; quantity: number }[];
  totalQuantity: number;
  totalValueFt: number;
};

// A customer's most recent distinct order dates (newest first), for the
// "same as last time" prefill chips on the ordering page.
export async function getSandwichCustomerHistory(
  customerId: string,
  limit = 5
): Promise<SandwichHistoryEntry[]> {
  const orders = await prisma.sandwichOrder.findMany({
    where: { customerId },
    orderBy: { orderDate: "desc" },
    take: limit,
    include: { lines: { include: { item: true } } },
  });

  return orders.map((order) => {
    const nonZeroLines = order.lines.filter((line) => line.quantity > 0);
    const lines = nonZeroLines.map((line) => ({
      itemId: line.itemId,
      itemName: line.item.name,
      quantity: line.quantity,
    }));
    return {
      orderDate: toDayStr(order.orderDate),
      lines,
      totalQuantity: sandwichOrderTotalCount(nonZeroLines),
      totalValueFt: sandwichOrderValueFt(nonZeroLines),
    };
  });
}
