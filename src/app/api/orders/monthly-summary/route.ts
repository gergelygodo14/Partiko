import { NextRequest, NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getMonthlyOrderSummary } from "@/lib/ordersSummary";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Defaults to the current calendar month (1st through the last day) -
// billing runs monthly, independent of the Monday-based order weeks used
// elsewhere - but browsable via ?month= for the Riportok page's turnover
// block, which needs to show whatever month the owner is browsing.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);

  const { weekStarts, byCustomer } = await getMonthlyOrderSummary(monthStart, monthEnd);
  const totalMeals = byCustomer.reduce((sum, c) => sum + c.totalMeals, 0);
  const totalValue = byCustomer.reduce((sum, c) => sum + c.totalValue, 0);

  return NextResponse.json({ monthStart, monthEnd, weekStarts, byCustomer, totalMeals, totalValue });
});
