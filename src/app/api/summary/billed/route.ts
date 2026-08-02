import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getBilledIngredientTotals } from "@/lib/summary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Browsable-by-month billed-ingredient turnover report (defaults to the
// current month) - for the Riportok page's Forgalom block and its
// consumption-trend section.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { rows, grandTotal } = await getBilledIngredientTotals(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, rows, grandTotal });
});
