import { NextRequest, NextResponse } from "next/server";
import { getActiveOrderWeek, mondayOf } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import { getOrdersSummary } from "@/lib/ordersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const weekParam = request.nextUrl.searchParams.get("week");
  if (weekParam !== null && !isValidDateStr(weekParam)) {
    return NextResponse.json({ error: "Érvénytelen week" }, { status: 400 });
  }
  const week = mondayOf(weekParam ?? getActiveOrderWeek(new Date()).weekStart);

  const { dayTotals, byCustomer } = await getOrdersSummary(week);

  return NextResponse.json({ weekStart: week, dayTotals, byCustomer });
});
