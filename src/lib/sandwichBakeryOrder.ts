import { addDaysStr, budapestTodayStr, parseDay } from "@/lib/dates";
import { toTargetDay } from "@/lib/sandwichDates";

// Maps sandwich catalog items to the bread/dough product the kitchen orders
// them on from the bakery supplier (UNIBREAD) - several sandwiches share the
// same underlying bread, so the bakery order is placed per bread type, not
// per sandwich. Confirmed with the owner from their own printed order form;
// labels below are that form's own wording, since the owner copies the
// Telegram message straight into Viber to place the actual order.
//
// "Csirkés tortilla", "Csirkés panini" and "Tépett húsos szendvics" are
// deliberately absent - they don't come from any of these bread types
// (confirmed with the owner), so they never contribute to a bakery need.
export type BakeryProductKey =
  | "bagel"
  | "vekni"
  | "tkVekni"
  | "sosPapucs"
  | "nagyHambi"
  | "kmol"
  | "hotdog"
  | "nagyi"
  | "mekkBuci"
  | "pogacsa"
  | "sajtburger"
  | "miniburger"
  | "extra"
  | "szegediVekni";

export const BAKERY_PRODUCTS: { key: BakeryProductKey; label: string }[] = [
  { key: "bagel", label: "bagel" },
  { key: "vekni", label: "Vekni" },
  { key: "tkVekni", label: "tk. Vekni" },
  { key: "sosPapucs", label: "Sós papucs" },
  { key: "nagyHambi", label: "nagy hambi" },
  { key: "kmol", label: "Kmol" },
  { key: "hotdog", label: "hot-dog" },
  { key: "nagyi", label: "nagyi" },
  { key: "mekkBuci", label: "mekk buci" },
  { key: "pogacsa", label: "pogácsa" },
  { key: "sajtburger", label: "Sajtburger" },
  { key: "miniburger", label: "miniburger" },
  { key: "extra", label: "EXTRA" },
  { key: "szegediVekni", label: "szegedi vekni" },
];

const BAKERY_PRODUCT_BY_ITEM_NAME: Record<string, BakeryProductKey> = {
  "Sonkás bagel": "bagel",
  "Fasírtos-pfefferonis szendvics": "vekni",
  "Rántott húsos vekni": "vekni",
  "Rántott húsos vekni (teljes kiőrlésű)": "tkVekni",
  "Grillezett csirkemell papucs": "sosPapucs",
  "Rántott húsos papucs": "sosPapucs",
  Hamburger: "nagyHambi",
  "Molnárka (kicsi) kolbászos": "kmol",
  "Molnárka (kicsi) sonkás": "kmol",
  "Molnárka (kicsi) szalámis": "kmol",
  "Csirkemelles bigkifli": "hotdog",
  "Fetasajtos bigkifli": "hotdog",
  "Nagyi kifli": "nagyi",
  Pleskavica: "mekkBuci",
  "Dupla szalámis pogácsa": "pogacsa",
  "Pötyi pogi (dupla rántott húsos pogácsa)": "pogacsa",
  Sajtburger: "sajtburger",
  "Dupla sajtburger": "sajtburger",
  "Mini burger": "miniburger",
  "Extra szendvics": "extra",
  "Mediterrán karajos vekni": "szegediVekni",
  "Szegedi sonkás vekni": "szegediVekni",
  "Piccante szalámis (olasz, csípős)": "szegediVekni",
};

export type BakeryNeedRow = { key: BakeryProductKey; label: string; needed: number };

/** Sums each item's ordered quantity into its bakery product, in
 *  BAKERY_PRODUCTS display order. Items with no mapping (see module doc)
 *  are silently skipped rather than erroring, since the catalog can grow
 *  items that don't map to a bread product at all. */
export function computeBakeryNeeds(byItem: { itemName: string; quantity: number }[]): BakeryNeedRow[] {
  const totals = new Map<BakeryProductKey, number>();
  for (const item of byItem) {
    const key = BAKERY_PRODUCT_BY_ITEM_NAME[item.itemName];
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + item.quantity);
  }
  return BAKERY_PRODUCTS.map(({ key, label }) => ({ key, label, needed: totals.get(key) ?? 0 }));
}

export type BakeryOrderPlan = {
  deliveryDate: string;
  dayName: string;
  demandDate: string;
  sourceDayName: string;
  isEstimate: boolean;
};

// Full weekly cycle, confirmed with the owner (2026-08-06). The owner orders
// bread "for tomorrow" (deliveryDate), and the kitchen uses it THAT day to
// prep for the day after (demandDate) - so the order must be sized off
// demandDate's sandwich-order volume, not deliveryDate's. This is NOT a
// weekday-only pattern: bread is delivered even on Sunday (for Monday's
// prep), which is why this uses plain +1/+2 day math rather than any
// business-day-skipping helper.
//
// Thursday and Friday place no order at all (null): Wednesday's delivery
// (used Thursday) already covers Friday's demand, and there's no
// Saturday/Sunday customer demand a Thursday- or Friday-placed order could
// be for.
//
// Saturday is the one EXACT day: stores don't operate weekends, so Monday's
// orders are already final by Saturday (nothing can change before Monday
// itself). Every other active day is an estimate off demandDate's weekday
// total from one week earlier, since demandDate's own order window is still
// open at order time.
export function bakeryOrderPlan(now: Date = new Date()): BakeryOrderPlan | null {
  const today = budapestTodayStr(now);
  const weekday = parseDay(today).getUTCDay(); // 0=Sun..6=Sat
  if (weekday === 4 || weekday === 5) return null; // Thursday, Friday: no order
  const deliveryDate = addDaysStr(today, 1);
  const demandDate = addDaysStr(today, 2);
  return {
    deliveryDate,
    dayName: toTargetDay(deliveryDate).dayName,
    demandDate,
    sourceDayName: toTargetDay(demandDate).dayName,
    isEstimate: weekday !== 6, // Saturday is the only exact day
  };
}

export type BakeryOrderRow = {
  key: BakeryProductKey;
  label: string;
  toOrder: number;
  leftover: number;
};

/** needed - leftover, floored at 0 (can't order a negative amount). Keeps
 *  leftover on the row (not just folded into toOrder) so a later reader
 *  (see /rendelesfelvetel's bakery comparison) can reconstruct the total
 *  actually on hand for that day - toOrder alone would understate it. */
export function computeBakeryOrderRows(
  needs: BakeryNeedRow[],
  leftovers: Partial<Record<BakeryProductKey, number>>
): BakeryOrderRow[] {
  return needs.map(({ key, label, needed }) => {
    const leftover = leftovers[key] ?? 0;
    return { key, label, toOrder: Math.max(needed - leftover, 0), leftover };
  });
}

// Deliberately phrased as a ready-to-send chat message, not an internal
// report - the owner copies this straight into Viber to place the real
// order with the supplier, so it carries no date/day-name/estimate-vs-exact
// framing (that context lives in the app's own UI, not in the message the
// bakery reads). deliveryDate in bakeryOrderPlan is always literally
// "tomorrow" relative to when the order is placed, so "holnapra" is always
// accurate without needing to spell out which date that is.
export function buildBakeryOrderNotificationText(params: { rows: BakeryOrderRow[] }): string {
  const nonZero = params.rows.filter((row) => row.toOrder > 0);
  const body =
    nonZero.length > 0
      ? nonZero.map((row) => `${row.label}: ${row.toOrder}db`).join("\n")
      : "(nincs rendelendő tétel)";
  return `Szia. holnapra ezeket szeretném rendelni:\n${body}\nKöszi!`;
}
