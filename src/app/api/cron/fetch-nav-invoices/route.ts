import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { importNavInvoicesForRange } from "@/lib/navInvoiceIngestion";
import { addDaysStr, todayStr } from "@/lib/dates";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// A few days' lookback rather than just "yesterday" - a supplier can report
// an invoice to NAV a day or two after issuing it, and importNavInvoicesForRange
// dedupes by [supplier, navInvoiceNumber] so re-checking overlapping days
// costs nothing but an already_imported result, same margin-of-safety
// reasoning as the price-list email cron's 10-day window.
const LOOKBACK_DAYS = 5;

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = todayStr();
  const from = addDaysStr(to, -LOOKBACK_DAYS);
  const outcomes = await importNavInvoicesForRange(from, to);

  return NextResponse.json({
    range: { from, to },
    checked: outcomes.length,
    imported: outcomes.filter((o) => o.status === "imported").length,
    outcomes,
  });
});
