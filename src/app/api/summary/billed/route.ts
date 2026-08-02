import { NextRequest, NextResponse } from "next/server";
import { addDaysStr, budapestTodayStr, mondayOf, monthEndOf, monthStartOf } from "@/lib/dates";
import { getBilledIngredientTotals } from "@/lib/summary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Browsable-by-month (default) or by-week billed-ingredient turnover report -
// for the Riportok page's Forgalom block (always monthly) and its
// consumption-trend section (owner can switch to weekly for finer-grained
// swings). getBilledIngredientTotals itself doesn't care whether the range
// it's given is a calendar month or a 7-day week - it just finds
// BillingPeriods closed within that window - so `week` only changes which
// [from, to] gets built here.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const weekParam = request.nextUrl.searchParams.get("week");
  if (weekParam) {
    if (!isValidDateStr(weekParam)) {
      return NextResponse.json({ error: "Érvénytelen week" }, { status: 400 });
    }
    const weekStart = mondayOf(weekParam);
    const weekEnd = addDaysStr(weekStart, 6); // full Mon-Sun, ingredient usage isn't Mon-Fri-only
    const { rows, grandTotal } = await getBilledIngredientTotals(weekStart, weekEnd);
    return NextResponse.json({ weekStart, weekEnd, rows, grandTotal });
  }

  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { rows, grandTotal } = await getBilledIngredientTotals(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, rows, grandTotal });
});
