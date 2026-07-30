import type { SandwichOrderItemInput } from "@/lib/sandwichOrders";

/** customerId -> itemId -> quantity. The order-entry grid's whole state.
 *  Absent and zero are equivalent throughout: the grid renders a blank cell
 *  for both, and neither is ever stored. */
export type GridQuantities = Record<string, Record<string, number>>;

export type GridItem = { itemId: string; price: number };

/** Strips zero and negative entries so `{a: 0}` and `{}` compare equal.
 *  Without this, typing a 3 and deleting it back to empty would leave the
 *  column looking dirty forever. */
export function normalizeColumn(column: Record<string, number> | undefined): Record<string, number> {
  if (!column) return {};
  const result: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(column)) {
    if (Number.isFinite(quantity) && quantity > 0) result[itemId] = Math.floor(quantity);
  }
  return result;
}

function sameColumn(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/** customerIds whose draft column differs from the server baseline. This is
 *  what the send button counts and what gets sent - untouched stores are never
 *  transmitted, so a concurrent self-service order in a column the owner never
 *  opened cannot be clobbered. */
export function diffDirtyStores(saved: GridQuantities, draft: GridQuantities): string[] {
  const customerIds = new Set([...Object.keys(saved), ...Object.keys(draft)]);
  const dirty: string[] = [];
  for (const customerId of customerIds) {
    if (!sameColumn(normalizeColumn(saved[customerId]), normalizeColumn(draft[customerId]))) {
      dirty.push(customerId);
    }
  }
  return dirty.sort();
}

export type ApplyTemplateMode =
  /** Overwrite the column outright - the "load this store's fix order" action. */
  | "replace"
  /** Only fill columns that are currently empty, so a call already recorded by
   *  hand is never overwritten by the bulk "load all fix orders" action. */
  | "onlyEmpty";

export function applyTemplate(
  draft: GridQuantities,
  customerId: string,
  template: Record<string, number>,
  mode: ApplyTemplateMode
): GridQuantities {
  const current = normalizeColumn(draft[customerId]);
  if (mode === "onlyEmpty" && Object.keys(current).length > 0) return draft;
  return { ...draft, [customerId]: normalizeColumn(template) };
}

export function applyTemplates(
  draft: GridQuantities,
  templates: Record<string, Record<string, number>>,
  mode: ApplyTemplateMode
): GridQuantities {
  let result = draft;
  for (const [customerId, template] of Object.entries(templates)) {
    result = applyTemplate(result, customerId, template, mode);
  }
  return result;
}

export function setQuantity(
  draft: GridQuantities,
  customerId: string,
  itemId: string,
  quantity: number
): GridQuantities {
  const column = { ...normalizeColumn(draft[customerId]) };
  const value = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (value === 0) delete column[itemId];
  else column[itemId] = value;
  return { ...draft, [customerId]: column };
}

export function clearColumn(draft: GridQuantities, customerId: string): GridQuantities {
  return { ...draft, [customerId]: {} };
}

export type GridTotals = {
  byStore: Record<string, { quantity: number; valueFt: number }>;
  byItem: Record<string, number>;
  totalQuantity: number;
  totalValueFt: number;
};

/** Live totals for the grid's Összesen row/column. Computed client-side from
 *  the draft (not from the server response) because the owner reads these back
 *  to the caller mid-call, before anything is saved. */
export function gridTotals(items: GridItem[], quantities: GridQuantities): GridTotals {
  const priceByItemId = new Map(items.map((item) => [item.itemId, item.price]));
  const byStore: Record<string, { quantity: number; valueFt: number }> = {};
  const byItem: Record<string, number> = {};
  let totalQuantity = 0;
  let totalValueFt = 0;

  for (const [customerId, rawColumn] of Object.entries(quantities)) {
    const column = normalizeColumn(rawColumn);
    let storeQuantity = 0;
    let storeValue = 0;
    for (const [itemId, quantity] of Object.entries(column)) {
      // Unknown/archived items contribute nothing - same defensive stance as
      // buildSandwichOrderLines, which drops them server-side.
      if (!priceByItemId.has(itemId)) continue;
      storeQuantity += quantity;
      storeValue += quantity * priceByItemId.get(itemId)!;
      byItem[itemId] = (byItem[itemId] ?? 0) + quantity;
    }
    byStore[customerId] = { quantity: storeQuantity, valueFt: storeValue };
    totalQuantity += storeQuantity;
    totalValueFt += storeValue;
  }

  return { byStore, byItem, totalQuantity, totalValueFt };
}

export type DaySavePayloadStore = { customerId: string; items: SandwichOrderItemInput[] };

/** The PUT body: only dirty stores, zero-stripped. A dirty store that ended up
 *  empty is still included - with an empty items array, which is how the server
 *  is told to delete that store's order for the day. */
export function toSavePayload(draft: GridQuantities, dirty: string[]): DaySavePayloadStore[] {
  return dirty.map((customerId) => ({
    customerId,
    items: Object.entries(normalizeColumn(draft[customerId])).map(([itemId, quantity]) => ({
      itemId,
      quantity,
    })),
  }));
}
