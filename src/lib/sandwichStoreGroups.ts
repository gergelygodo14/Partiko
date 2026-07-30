import type { StoreGroup } from "@/generated/prisma/client";
import { isVidekStore } from "@/lib/sandwichVidekStores";

/** Display/print order of the groups. Vidék goes last everywhere because it
 *  is physically a separate delivery round (its own .xlsx sheet, its own
 *  table on the entry screen), not just another section of the same list. */
export const STORE_GROUP_ORDER: StoreGroup[] = ["FAV", "COOP", "EGYEB", "VIDEK"];

export const STORE_GROUP_LABELS: Record<StoreGroup, string> = {
  FAV: "FAV boltok",
  COOP: "Coop boltok",
  EGYEB: "Egyéb",
  VIDEK: "Vidék (külön kör)",
};

/** Which group a store name *looks* like it belongs to. Only a suggestion:
 *  Customer.storeGroup is the authority once set, and the owner can override
 *  it. Used to seed the column during backfill/import and to pre-select the
 *  dropdown when adding a new store.
 *
 *  Vidék is checked FIRST and wins: "COOP MÓRA" is a countryside store
 *  despite the Coop prefix. The old hardcoded logic got this right only
 *  because generateSandwichOrdersXlsx filtered vidék out before ever calling
 *  groupFavAndCoopAdjacent - here the precedence has to be explicit. */
export function suggestStoreGroup(storeName: string): StoreGroup {
  if (isVidekStore(storeName)) return "VIDEK";
  const name = storeName.trim();
  if (/^fav\b/i.test(name)) return "FAV";
  if (/^coop\b/i.test(name)) return "COOP";
  return "EGYEB";
}

export type GroupedStore = { storeGroup: StoreGroup; storeOrder: number; storeName: string };

/** Grid/list ordering within a group: the owner's own column order from the
 *  reference workbook (storeOrder), Hungarian-collated name as tie-break.
 *
 *  NOTE: deliberately NOT used by generateSandwichOrdersXlsx - the printout
 *  keeps its biggest-orderer-first ordering, and feeding storeOrder into it
 *  would change the printed sheet. */
export function compareStoresForGrid<T extends GroupedStore>(a: T, b: T): number {
  const groupDiff =
    STORE_GROUP_ORDER.indexOf(a.storeGroup) - STORE_GROUP_ORDER.indexOf(b.storeGroup);
  if (groupDiff !== 0) return groupDiff;
  return a.storeOrder - b.storeOrder || a.storeName.localeCompare(b.storeName, "hu");
}

export type StoreGroupBlock<T> = { group: StoreGroup; label: string; stores: T[] };

/** Splits stores into the blocks the entry screen renders, in STORE_GROUP_ORDER.
 *  Empty groups are omitted so an all-in-town day doesn't render an empty
 *  "Vidék" heading. */
export function groupStoresForGrid<T extends GroupedStore>(stores: T[]): StoreGroupBlock<T>[] {
  const sorted = [...stores].sort(compareStoresForGrid);
  return STORE_GROUP_ORDER.map((group) => ({
    group,
    label: STORE_GROUP_LABELS[group],
    stores: sorted.filter((store) => store.storeGroup === group),
  })).filter((block) => block.stores.length > 0);
}
