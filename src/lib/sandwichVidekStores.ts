// Stores on the countryside ("vidék") delivery round - a different driver
// picks these up, so the kitchen export must keep them on their own sheet,
// never mixed in with the in-town stores. Hand-extracted from the reference
// spreadsheet's "HÉTFŐ DU VIDÉK" and "SZERDA VIDÉK" tabs (union of both -
// the roster varies slightly day to day, but a given physical store is
// always on this route regardless of which day it ordered on that sheet).
const VIDEK_STORE_NAMES = new Set(
  ["KISSZÁLLÁS", "COOP MÓRA", "HATÁR", "KIRÁLY ZSÓKA", "OMV"].map((n) => n.toLowerCase())
);

export function isVidekStore(storeName: string): boolean {
  return VIDEK_STORE_NAMES.has(storeName.trim().toLowerCase());
}
