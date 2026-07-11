import { NextResponse } from "next/server";
import { getActiveOrderWeek, getExportDay } from "@/lib/dates";
import { emptyOrderWeek, orderValue } from "@/lib/orders";
import {
  dayTotal,
  getDishNamesForDay,
  getOrdersForDay,
  getOrdersSummary,
  getWeekTotalMeals,
  getWeekTotalValue,
} from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const now = new Date();
  const { date, weekStart, dayIndex } = getExportDay(now);
  const activeWeek = getActiveOrderWeek(now);

  const [dishNames, dayResult, weekTotalMeals, weekTotalValue] = await Promise.all([
    getDishNamesForDay(weekStart, dayIndex),
    dayIndex === null
      ? Promise.resolve({ totals: emptyOrderWeek()[0], byCustomer: [] })
      : getOrdersForDay(weekStart, dayIndex),
    getWeekTotalMeals(weekStart),
    getWeekTotalValue(weekStart),
  ]);

  // Customers can already be ordering against next week (past the Thursday
  // 10:00 cutoff) while this page is still showing tomorrow's day within the
  // current week (it only flips over the Sun->Mon boundary) - surface that
  // otherwise-invisible next-week activity separately when the two diverge.
  let nextWeek = null;
  if (activeWeek.weekStart !== weekStart) {
    const { dayTotals, byCustomer } = await getOrdersSummary(activeWeek.weekStart);
    const totalMeals = dayTotals.reduce((sum, day) => sum + dayTotal(day), 0);
    const totalValue = dayTotals.reduce((sum, day) => sum + orderValue(day), 0);
    nextWeek = {
      weekStart: activeWeek.weekStart,
      dayTotals: dayTotals.map(dayTotal),
      byCustomer: byCustomer.map((c) => ({
        customerId: c.customerId,
        storeName: c.storeName,
        days: c.days.map(dayTotal),
        total: c.days.reduce((sum, day) => sum + dayTotal(day), 0),
        value: c.days.reduce((sum, day) => sum + orderValue(day), 0),
      })),
      totalMeals,
      totalValue,
    };
  }

  return NextResponse.json({
    date,
    dishNames,
    dayTotals: dayResult.totals,
    byCustomer: dayResult.byCustomer,
    weekTotalMeals,
    weekTotalValue,
    nextWeek,
  });
});
