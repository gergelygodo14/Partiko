import { NextResponse } from "next/server";
import { budapestTodayStr, monthEndOf, monthStartOf } from "@/lib/dates";
import { getSandwichMonthSummary } from "@/lib/sandwichOrdersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always the current calendar month (1st through the last day), same
// convention as the ready-meal monthly summary.
export const GET = withApiErrorHandling(async () => {
  const today = budapestTodayStr(new Date());
  const monthStart = monthStartOf(today);
  const monthEnd = monthEndOf(today);

  const summary = await getSandwichMonthSummary(monthStart, monthEnd);
  return NextResponse.json({ monthStart, monthEnd, ...summary });
});
