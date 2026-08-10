import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { addDaysStr } from "@/lib/dates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import {
  BAKERY_PRODUCTS,
  bakeryOrderPlan,
  buildBakeryOrderNotificationText,
  computeBakeryNeeds,
  type BakeryOrderRow,
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

// Still recomputes `date` server-side rather than trusting whatever the
// client last rendered - the modal can stay open a while, and a stale
// `date` would save/send the wrong day's order. The actual quantities,
// though, come straight from the client: the owner can edit the "rendelendő"
// estimate before sending (see BakeryOrderDialog), and the whole point is
// that the number that goes out is the number they typed, not a
// server-recomputed estimate that would silently discard their edit.
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const computed = await computeNeedsForNow();
  if (!computed) {
    return NextResponse.json({ error: "Ma nincs pékáru rendelés" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const rowsInput = Array.isArray(body?.rows) ? body.rows : [];
  const rowByKey = new Map<BakeryProductKey, { toOrder: number; leftover: number }>();
  for (const entry of rowsInput) {
    const key = entry?.key;
    if (!BAKERY_PRODUCTS.some((p) => p.key === key)) continue;
    const toOrder = Number(entry?.toOrder);
    const leftover = Number(entry?.leftover);
    rowByKey.set(key, {
      toOrder: Number.isFinite(toOrder) && toOrder > 0 ? Math.round(toOrder) : 0,
      leftover: Number.isFinite(leftover) && leftover > 0 ? Math.round(leftover) : 0,
    });
  }
  const rows: BakeryOrderRow[] = BAKERY_PRODUCTS.map(({ key, label }) => {
    const entry = rowByKey.get(key);
    return { key, label, toOrder: entry?.toOrder ?? 0, leftover: entry?.leftover ?? 0 };
  });

  const { date } = computed;
  const text = buildBakeryOrderNotificationText({ rows });

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
