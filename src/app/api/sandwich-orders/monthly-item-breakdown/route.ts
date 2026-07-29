import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getSandwichMonthDailyItemTotals } from "@/lib/sandwichOrdersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Item x business-day matrix for a browsable calendar month (defaults to the
// current month) - lets the owner see how each sandwich's daily volume
// moved across the whole month, same shape as the "havi július" tab in
// their own reference workbook.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { businessDays, items } = await getSandwichMonthDailyItemTotals(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, businessDays, items });
});
