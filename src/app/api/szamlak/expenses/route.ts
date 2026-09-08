import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { budapestTodayStr, monthEndOf, monthStartOf, rangeBetween } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { summarizeMonthlyExpenses } from "@/lib/expenseSummary";

// Browsable-by-month "Kiadások" report for Riportok (owner request,
// 2026-09-08) - same ?month= convention as monthly-profit/monthly-summary.
// Scoped to NAV-sourced invoices only, same reasoning as
// GET /api/szamlak/nav-invoices: those are the only rows with
// issueDate/netAmountHUF/vatAmountHUF populated.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const monthParam = request.nextUrl.searchParams.get("month") ?? budapestTodayStr(new Date());
  if (!isValidDateStr(monthParam)) {
    return NextResponse.json({ error: "Érvénytelen month" }, { status: 400 });
  }
  const monthStart = monthStartOf(monthParam);
  const monthEnd = monthEndOf(monthParam);
  const { gte, lt } = rangeBetween(monthStart, monthEnd);

  const rows = await prisma.invoice.findMany({
    where: { navInvoiceNumber: { not: null }, issueDate: { gte, lt } },
    select: { supplier: true, supplierName: true, netAmountHUF: true, vatAmountHUF: true },
  });

  return NextResponse.json({ monthStart, monthEnd, ...summarizeMonthlyExpenses(rows) });
});
