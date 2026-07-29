import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getSandwichMonthProfit } from "@/lib/sandwichOrdersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Browsable-by-month profit report (defaults to the current month) - per
// item: quantity ordered x the owner's own hand-entered profit-per-unit
// figure (SandwichItem.profitFt).
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { items, totalProfitFt } = await getSandwichMonthProfit(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, items, totalProfitFt });
});
