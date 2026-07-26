// Sandwiches are a variable, admin-editable catalog (not a fixed A/B/C
// letter set like the ready-meal weekly menu), so an order is just a list
// of {itemId, quantity} pairs rather than a fixed-shape day grid.
export type SandwichOrderItemInput = { itemId: string; quantity: number };

export type SandwichOrderLineRecord = {
  itemId: string;
  quantity: number;
  unitPriceFt: number;
};

// Only an advisory threshold shown in the ordering UI, not enforced server-side
// yet (see plan notes) - kept as a named constant so promoting it to a hard
// block later is a small, contained change.
export const MIN_ORDER_VALUE_FT = 4000;

export function isValidSandwichOrderItems(value: unknown): value is SandwichOrderItemInput[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const i = item as Record<string, unknown>;
    return (
      typeof i.itemId === "string" &&
      i.itemId.length > 0 &&
      typeof i.quantity === "number" &&
      Number.isInteger(i.quantity) &&
      i.quantity >= 0
    );
  });
}

// Drops zero-quantity rows (nothing to store) and any itemId not present in
// priceByItemId (an archived/unknown item - defensive, avoids a foreign-key
// failure from a stale client payload), and snapshots the current catalog
// price onto each line so a later admin price edit never rewrites history.
export function buildSandwichOrderLines(
  items: SandwichOrderItemInput[],
  priceByItemId: Map<string, number>
): SandwichOrderLineRecord[] {
  return items
    .filter((item) => item.quantity > 0 && priceByItemId.has(item.itemId))
    .map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      unitPriceFt: priceByItemId.get(item.itemId)!,
    }));
}

export function sandwichOrderValueFt(lines: { quantity: number; unitPriceFt: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPriceFt, 0);
}

export function sandwichOrderTotalCount(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
