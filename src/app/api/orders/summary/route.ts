import { NextResponse } from "next/server";
import { getExportDay } from "@/lib/dates";
import { MEAL_PRICE_FT } from "@/lib/orders";
import { getDishNamesForDay, getOrdersForDay, getWeekTotalMeals } from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const { date, weekStart, dayIndex } = getExportDay(new Date());

  const [dishNames, dayResult, weekTotalMeals] = await Promise.all([
    getDishNamesForDay(weekStart, dayIndex),
    dayIndex === null
      ? Promise.resolve({ totals: { a: 0, b: 0, c: 0 }, byCustomer: [] })
      : getOrdersForDay(weekStart, dayIndex),
    getWeekTotalMeals(weekStart),
  ]);

  return NextResponse.json({
    date,
    dishNames,
    dayTotals: dayResult.totals,
    byCustomer: dayResult.byCustomer,
    weekTotalMeals,
    weekTotalValue: weekTotalMeals * MEAL_PRICE_FT,
  });
});
