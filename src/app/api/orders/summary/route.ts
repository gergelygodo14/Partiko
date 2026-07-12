import { NextResponse } from "next/server";
import { getActiveOrderWeek, getExportDay } from "@/lib/dates";
import { emptyOrderWeek, orderValue } from "@/lib/orders";
import { dayTotal, getDishNamesForDay, getOrdersForDay, getOrdersSummary } from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const now = new Date();
  const { date, weekStart, dayIndex } = getExportDay(now);
  const activeWeek = getActiveOrderWeek(now);

  const [dishNames, dayResult, weekSummary] = await Promise.all([
    getDishNamesForDay(weekStart, dayIndex),
    dayIndex === null
      ? Promise.resolve({ totals: emptyOrderWeek()[0], byCustomer: [] })
      : getOrdersForDay(weekStart, dayIndex),
    getOrdersSummary(activeWeek.weekStart),
  ]);

  const totalMeals = weekSummary.dayTotals.reduce((sum, day) => sum + dayTotal(day), 0);
  const totalValue = weekSummary.dayTotals.reduce((sum, day) => sum + orderValue(day), 0);

  return NextResponse.json({
    day: {
      date,
      dishNames,
      dayTotals: dayResult.totals,
      byCustomer: dayResult.byCustomer,
    },
    week: {
      weekStart: activeWeek.weekStart,
      dayTotals: weekSummary.dayTotals.map(dayTotal),
      byCustomer: weekSummary.byCustomer.map((c) => ({
        customerId: c.customerId,
        storeName: c.storeName,
        days: c.days.map(dayTotal),
        total: c.days.reduce((sum, day) => sum + dayTotal(day), 0),
        value: c.days.reduce((sum, day) => sum + orderValue(day), 0),
      })),
      totalMeals,
      totalValue,
    },
  });
});
