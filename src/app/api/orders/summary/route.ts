import { NextResponse } from "next/server";
import { getActiveOrderWeek, getExportDay } from "@/lib/dates";
import { emptyOrderWeek, MEAL_PRICE_FT, ORDER_QUANTITY_FIELDS, type OrderDayQuantities } from "@/lib/orders";
import { getDishNamesForDay, getOrdersForDay, getOrdersSummary, getWeekTotalMeals } from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

function dayTotal(day: OrderDayQuantities): number {
  return ORDER_QUANTITY_FIELDS.reduce((sum, field) => sum + day[field], 0);
}

export const GET = withApiErrorHandling(async () => {
  const now = new Date();
  const { date, weekStart, dayIndex } = getExportDay(now);
  const activeWeek = getActiveOrderWeek(now);

  const [dishNames, dayResult, weekTotalMeals] = await Promise.all([
    getDishNamesForDay(weekStart, dayIndex),
    dayIndex === null
      ? Promise.resolve({ totals: emptyOrderWeek()[0], byCustomer: [] })
      : getOrdersForDay(weekStart, dayIndex),
    getWeekTotalMeals(weekStart),
  ]);

  // Customers can already be ordering against next week (past the Thursday
  // 10:00 cutoff) while this page is still showing tomorrow's day within the
  // current week (it only flips over the Sun->Mon boundary) - surface that
  // otherwise-invisible next-week activity separately when the two diverge.
  let nextWeek = null;
  if (activeWeek.weekStart !== weekStart) {
    const { dayTotals, byCustomer } = await getOrdersSummary(activeWeek.weekStart);
    const totalMeals = dayTotals.reduce((sum, day) => sum + dayTotal(day), 0);
    nextWeek = {
      weekStart: activeWeek.weekStart,
      dayTotals: dayTotals.map(dayTotal),
      byCustomer: byCustomer.map((c) => ({
        customerId: c.customerId,
        storeName: c.storeName,
        days: c.days.map(dayTotal),
        total: c.days.reduce((sum, day) => sum + dayTotal(day), 0),
      })),
      totalMeals,
      totalValue: totalMeals * MEAL_PRICE_FT,
    };
  }

  return NextResponse.json({
    date,
    dishNames,
    dayTotals: dayResult.totals,
    byCustomer: dayResult.byCustomer,
    weekTotalMeals,
    weekTotalValue: weekTotalMeals * MEAL_PRICE_FT,
    nextWeek,
  });
});
