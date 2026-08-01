import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getMonthlyMealProfit } from "@/lib/ordersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Browsable-by-month ready-meal profit report (defaults to the current
// month) - flat MEAL_PROFIT_FT per portion, since ready meals have no
// per-dish profit field like sandwiches do.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { totalMeals, totalProfitFt } = await getMonthlyMealProfit(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, totalMeals, totalProfitFt });
});
