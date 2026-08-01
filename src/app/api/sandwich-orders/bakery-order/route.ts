import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { addDaysStr } from "@/lib/dates";
import { getSandwichExportDay, isTodaySaturdayInBudapest } from "@/lib/sandwichDates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import {
  BAKERY_PRODUCTS,
  buildBakeryOrderNotificationText,
  computeBakeryNeeds,
  computeBakeryOrderRows,
  type BakeryProductKey,
} from "@/lib/sandwichBakeryOrder";
import { sendTelegramMessage } from "@/lib/telegram";

// Saturday is the only day tomorrow's (= Monday's) store orders are already
// closed, so it's the only day the bakery need can be read straight off the
// real target-day total - every other day falls back to an estimate off the
// same weekday one week earlier (confirmed with the owner).
async function computeNeedsForNow() {
  const { date, dayName } = getSandwichExportDay(new Date());
  const isEstimate = !isTodaySaturdayInBudapest(new Date());
  const sourceDate = isEstimate ? addDaysStr(date, -7) : date;
  const items = await getSandwichItemTotalsForDay(sourceDate);
  return { date, dayName, isEstimate, needs: computeBakeryNeeds(items) };
}

export const GET = withApiErrorHandling(async () => {
  return NextResponse.json(await computeNeedsForNow());
});

// Recomputes the needs server-side rather than trusting whatever the client
// last rendered - the modal can stay open a while, and the owner shouldn't
// end up sending a Telegram order built off a stale need figure.
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const leftovers: Partial<Record<BakeryProductKey, number>> = {};
  if (body?.leftovers && typeof body.leftovers === "object") {
    for (const { key } of BAKERY_PRODUCTS) {
      const value = body.leftovers[key];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        leftovers[key] = value;
      }
    }
  }

  const { date, dayName, isEstimate, needs } = await computeNeedsForNow();
  const rows = computeBakeryOrderRows(needs, leftovers);
  const text = buildBakeryOrderNotificationText({ date, dayName, isEstimate, rows });

  const result = await sendTelegramMessage(text);
  return NextResponse.json({ text, sent: result.ok, error: result.ok ? null : result.error });
});
