// Schools on the fixed-order round (2026-08-24 óta) - a genuinely separate
// customer type (institutional, standing weekly order) from the regular
// shop round, so they must stay off the in-town sheet/grid entirely, same
// treatment as isVidekStore(). Hand-entered from the owner's reference
// photo (6 schools, first live order 2026-09-01).
const ISKOLA_STORE_NAMES = new Set(
  ["GYÍK", "CSONKA", "DÉRY", "DEÁK", "RADNÓTI", "Szent Benedek"].map((n) => n.toLowerCase())
);

export function isIskolaStore(storeName: string): boolean {
  return ISKOLA_STORE_NAMES.has(storeName.trim().toLowerCase());
}
