import { NextResponse } from "next/server";
import { addDaysStr, getActiveOrderWeek, getExportDay } from "@/lib/dates";
import { orderValue } from "@/lib/orders";
import {
  dayTotal,
  getDishNamesForWeek,
  getOrdersByDayForWeek,
  getOrdersSummary,
} from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const now = new Date();
  const activeWeek = getActiveOrderWeek(now);
  const exportDay = getExportDay(now);

  const [dishNamesForWeek, dayResults, weekSummary] = await Promise.all([
    getDishNamesForWeek(activeWeek.weekStart),
    getOrdersByDayForWeek(activeWeek.weekStart),
    getOrdersSummary(activeWeek.weekStart),
  ]);

  const totalMeals = weekSummary.dayTotals.reduce((sum, day) => sum + dayTotal(day), 0);
  const totalValue = weekSummary.dayTotals.reduce((sum, day) => sum + orderValue(day), 0);

  // Pre-select tomorrow's day when it falls within the week being shown;
  // otherwise (e.g. tomorrow already belongs to next week, past the
  // Thursday-10:00 ordering cutoff) default to Monday.
  const defaultDayIndex =
    exportDay.weekStart === activeWeek.weekStart && exportDay.dayIndex !== null
      ? exportDay.dayIndex
      : 0;

  return NextResponse.json({
    weekDays: dayResults.map((result, i) => ({
      date: addDaysStr(activeWeek.weekStart, i),
      dishNames: dishNamesForWeek[i],
      dayTotals: result.totals,
      byCustomer: result.byCustomer,
    })),
    defaultDayIndex,
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
