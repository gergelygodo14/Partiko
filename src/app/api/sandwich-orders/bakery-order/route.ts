import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { addDaysStr } from "@/lib/dates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import {
  BAKERY_PRODUCTS,
  bakeryOrderPlan,
  buildBakeryOrderNotificationText,
  computeBakeryNeeds,
  computeBakeryOrderRows,
  type BakeryProductKey,
} from "@/lib/sandwichBakeryOrder";
import { saveBakeryOrder } from "@/lib/sandwichBakeryOrderStore";
import { sendTelegramMessage } from "@/lib/telegram";

type Needs = {
  date: string;
  dayName: string;
  isEstimate: boolean;
  sourceDayName: string;
  needs: ReturnType<typeof computeBakeryNeeds>;
};

async function computeNeedsForNow(): Promise<Needs | null> {
  const plan = bakeryOrderPlan(new Date());
  if (!plan) return null;
  const sourceDate = plan.isEstimate ? addDaysStr(plan.demandDate, -7) : plan.demandDate;
  const items = await getSandwichItemTotalsForDay(sourceDate);
  return {
    date: plan.deliveryDate,
    dayName: plan.dayName,
    isEstimate: plan.isEstimate,
    sourceDayName: plan.sourceDayName,
    needs: computeBakeryNeeds(items),
  };
}

export const GET = withApiErrorHandling(async () => {
  const result = await computeNeedsForNow();
  return NextResponse.json(result ?? { noOrderToday: true });
});

// Recomputes the needs server-side rather than trusting whatever the client
// last rendered - the modal can stay open a while, and the owner shouldn't
// end up sending a Telegram order built off a stale need figure.
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const computed = await computeNeedsForNow();
  if (!computed) {
    return NextResponse.json({ error: "Ma nincs pékáru rendelés" }, { status: 400 });
  }

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

  const { date, dayName, isEstimate, needs } = computed;
  const rows = computeBakeryOrderRows(needs, leftovers);
  const text = buildBakeryOrderNotificationText({ date, dayName, isEstimate, rows });

  // Recorded regardless of whether the Telegram send below succeeds - this is
  // the order the owner was shown and would place manually in Viber either
  // way, and /rendelesfelvetel's comparison should reflect that decision even
  // if the notification channel had a hiccup.
  await saveBakeryOrder(date, rows);

  const sendResult = await sendTelegramMessage(text);
  return NextResponse.json({
    text,
    sent: sendResult.ok,
    error: sendResult.ok ? null : sendResult.error,
  });
});
