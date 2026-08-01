export type ItemQuantityRow = { itemId: string; itemName: string; quantity: number };

/** How many items to show on each side - capped so a small catalog never
 *  shows the same item as both a top and bottom performer. */
export function rankSandwichItems(
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

// Below this, a swing is just noise (an item going from 1 to 3 "grew" 200%
// but nobody cares) - only items where at least one period reached this
// volume are considered at all.
const TREND_MIN_QUANTITY = 5;
// How big a change has to be, in percent, to count as "notable" once past
// the volume floor above.
const TREND_THRESHOLD_PERCENT = 30;

/** Flags sandwiches with a notable month-over-month swing, in both
 *  directions - including items that vanished entirely (in previousByItem
 *  but absent from currentByItem, i.e. currentQuantity 0) and items that
 *  debuted this period (previousQuantity 0, so changePercent is null rather
 *  than a meaningless divide-by-zero). Sorted growth-first, biggest swing
 *  first within each direction. */
export function computeItemTrends(
  currentByItem: ItemQuantityRow[],
  previousByItem: ItemQuantityRow[]
): ItemTrendRow[] {
  const currentMap = new Map(currentByItem.map((item) => [item.itemId, item]));
  const previousMap = new Map(previousByItem.map((item) => [item.itemId, item]));
  const allIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const rows: ItemTrendRow[] = [];
  for (const itemId of allIds) {
    const current = currentMap.get(itemId);
    const previous = previousMap.get(itemId);
    const currentQuantity = current?.quantity ?? 0;
    const previousQuantity = previous?.quantity ?? 0;
    if (Math.max(currentQuantity, previousQuantity) < TREND_MIN_QUANTITY) continue;

    const changePercent =
      previousQuantity === 0 ? null : ((currentQuantity - previousQuantity) / previousQuantity) * 100;
    const isNotable = changePercent === null || Math.abs(changePercent) >= TREND_THRESHOLD_PERCENT;
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
