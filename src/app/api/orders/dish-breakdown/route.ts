import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { computeDishAverageFlags, getMonthlyDishBreakdown } from "@/lib/ordersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Browsable-by-month per-dish quantity report (defaults to the current
// month) - which dish names (resolved from that week's WeeklyMenu text, see
// getMonthlyDishBreakdown) were ordered more/less than the average across
// every distinct dish served that month.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const dishes = await getMonthlyDishBreakdown(monthStart, monthEnd);
  const { averageQuantity, rows } = computeDishAverageFlags(dishes);
  return NextResponse.json({ monthStart, monthEnd, averageQuantity, dishes: rows });
});
