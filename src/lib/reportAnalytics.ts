export type ItemQuantityRow = { itemId: string; itemName: string; quantity: number };

/** How many items to show on each side - capped so a small catalog never
 *  shows the same item as both a top and bottom performer. */
export function rankItems(
  byItem: ItemQuantityRow[],
  count = 5
): { topItems: ItemQuantityRow[]; bottomItems: ItemQuantityRow[] } {
  const ordered = [...byItem]
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName, "hu"));

  const safeCount = Math.min(count, Math.floor(ordered.length / 2));
  if (safeCount === 0) return { topItems: ordered, bottomItems: [] };

  return {
    topItems: ordered.slice(0, safeCount),
    // Worst-first (ascending quantity), and disjoint from topItems by construction.
    bottomItems: ordered.slice(-safeCount).reverse(),
  };
}

export type ItemTrendRow = {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  previousQuantity: number;
  /** null when previousQuantity is 0 - no previous volume to compute a % off of. */
  changePercent: number | null;
  direction: "up" | "down";
};

// Defaults tuned for sandwich portion counts - callers whose "quantity" is a
// different unit (kg, liter, Ft...) should pass their own minQuantity, since
// an absolute floor of 5 doesn't mean the same thing across units.
const DEFAULT_MIN_QUANTITY = 5;
const DEFAULT_THRESHOLD_PERCENT = 30;

/** Flags items with a notable period-over-period swing, in both directions -
 *  including items that vanished entirely (in previousByItem but absent from
 *  currentByItem, i.e. currentQuantity 0) and items that debuted this period
 *  (previousQuantity 0, so changePercent is null rather than a meaningless
 *  divide-by-zero). Sorted growth-first, biggest swing first within each
 *  direction. Each row compares an item only against its own previous value,
 *  never against a different item, so mixing units across rows (kg here, db
 *  there) is safe - only the min-quantity floor needs to be unit-aware. */
export function computeItemTrends(
  currentByItem: ItemQuantityRow[],
  previousByItem: ItemQuantityRow[],
  opts?: { minQuantity?: number; thresholdPercent?: number }
): ItemTrendRow[] {
  const minQuantity = opts?.minQuantity ?? DEFAULT_MIN_QUANTITY;
  const thresholdPercent = opts?.thresholdPercent ?? DEFAULT_THRESHOLD_PERCENT;

  const currentMap = new Map(currentByItem.map((item) => [item.itemId, item]));
  const previousMap = new Map(previousByItem.map((item) => [item.itemId, item]));
  const allIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const rows: ItemTrendRow[] = [];
  for (const itemId of allIds) {
    const current = currentMap.get(itemId);
    const previous = previousMap.get(itemId);
    const currentQuantity = current?.quantity ?? 0;
    const previousQuantity = previous?.quantity ?? 0;
    if (Math.max(currentQuantity, previousQuantity) < minQuantity) continue;

    const changePercent =
      previousQuantity === 0 ? null : ((currentQuantity - previousQuantity) / previousQuantity) * 100;
    const isNotable = changePercent === null || Math.abs(changePercent) >= thresholdPercent;
    if (!isNotable) continue;

    rows.push({
      itemId,
      itemName: (current ?? previous)!.itemName,
      currentQuantity,
      previousQuantity,
      changePercent,
      direction: currentQuantity >= previousQuantity ? "up" : "down",
    });
  }

  return rows.sort((a, b) => {
    const aValue = a.changePercent ?? Infinity;
    const bValue = b.changePercent ?? Infinity;
    return bValue - aValue;
  });
}
