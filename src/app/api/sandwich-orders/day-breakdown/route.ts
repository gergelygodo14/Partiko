import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, mondayOf } from "@/lib/dates";
import { getSandwichWeekDailyItemTotals } from "@/lib/sandwichOrdersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Per-weekday item totals for a browsable week (defaults to the current
// calendar week) - lets the owner flip back to e.g. last Wednesday to see
// what to base this Wednesday's bakery order on.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const weekParam = request.nextUrl.searchParams.get("week") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(weekParam)) {
    return NextResponse.json({ error: "Érvénytelen week" }, { status: 400 });
  }
  const weekStart = mondayOf(weekParam);
  const days = await getSandwichWeekDailyItemTotals(weekStart);
  return NextResponse.json({ weekStart, days });
});
