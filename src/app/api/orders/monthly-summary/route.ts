import { NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getMonthlyOrderSummary } from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always the current calendar month (1st through the last day) - billing
// runs monthly, independent of the Monday-based order weeks used elsewhere.
export const GET = withApiErrorHandling(async () => {
  const today = budapestTodayStr(new Date());
  const monthStart = monthStartOf(today);
  const monthEnd = monthEndOf(today);

  const byCustomer = await getMonthlyOrderSummary(monthStart, monthEnd);
  const totalMeals = byCustomer.reduce((sum, c) => sum + c.totalMeals, 0);
  const totalValue = byCustomer.reduce((sum, c) => sum + c.totalValue, 0);

  return NextResponse.json({ monthStart, monthEnd, byCustomer, totalMeals, totalValue });
});
