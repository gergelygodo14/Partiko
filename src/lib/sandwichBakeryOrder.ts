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

export type BakeryOrderRow = { label: string; toOrder: number };

/** needed - leftover, floored at 0 (can't order a negative amount). */
export function computeBakeryOrderRows(
  needs: BakeryNeedRow[],
  leftovers: Partial<Record<BakeryProductKey, number>>
): BakeryOrderRow[] {
  return needs.map(({ key, label, needed }) => ({
    label,
    toOrder: Math.max(needed - (leftovers[key] ?? 0), 0),
  }));
}

export function buildBakeryOrderNotificationText(params: {
  date: string;
  dayName: string;
  isEstimate: boolean;
  rows: BakeryOrderRow[];
}): string {
  const { date, dayName, isEstimate, rows } = params;
  const nonZero = rows.filter((row) => row.toOrder > 0);
  const body =
    nonZero.length > 0
      ? nonZero.map((row) => `${row.label}: ${row.toOrder}db`).join("\n")
      : "(nincs rendelendő tétel)";
  const title = isEstimate ? "🥖 Pékáru rendelés (becslés, előző hét alapján)" : "🥖 Pékáru rendelés";

  return `${title} – ${dayName} (${date})\n\n${body}`;
}
