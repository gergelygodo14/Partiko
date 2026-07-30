import { describe, expect, it } from "vitest";
import type { StoreGroup } from "@/generated/prisma/client";
import { MONDAY_REFERENCE_ORDERS } from "@/lib/mondayReferenceOrders";
import {
  compareStoresForGrid,
  groupStoresForGrid,
  OVERRIDDEN_STORE_NAMES,
  STORE_GROUP_ORDER,
  suggestStoreGroup,
} from "@/lib/sandwichStoreGroups";
import { isVidekStore } from "@/lib/sandwichVidekStores";

// Test-local copy of the grouping rules exactly as they were hardcoded before
// Customer.storeGroup existed: isVidekStore() in generateSandwichOrdersXlsx's
// vidék filter, then groupFavAndCoopAdjacent's own name regexes. Kept here as
// the reference implementation so the parity assertion below survives after
// the regexes leave production code.
function legacyGroupOf(storeName: string): StoreGroup {
  if (isVidekStore(storeName)) return "VIDEK";
  const name = storeName.trim();
  if (/^fav\b/i.test(name)) return "FAV";
  if (/^coop\b/i.test(name)) return "COOP";
  return "EGYEB";
}

describe("suggestStoreGroup", () => {
  // MONDAY_REFERENCE_ORDERS's keys are the real store names as written in the
  // reference workbook (33 of them, inconsistent casing included), so this is
  // a parity check against actual production data, not invented examples.
  const realStoreNames = Object.keys(MONDAY_REFERENCE_ORDERS);

  it("covers a meaningful corpus of real store names", () => {
    expect(realStoreNames.length).toBeGreaterThanOrEqual(30);
  });

  // Parity holds for every store EXCEPT the explicit owner overrides. Those are
  // deliberate divergences from the old name-pattern behavior, and the
  // exclusion is driven off OVERRIDDEN_STORE_NAMES so a new override cannot be
  // added without this test noticing.
  const patternStoreNames = realStoreNames.filter(
    (name) => !OVERRIDDEN_STORE_NAMES.includes(name.trim().toLowerCase())
  );

  it.each(patternStoreNames)("matches the legacy hardcoded grouping for %s", (storeName) => {
    expect(suggestStoreGroup(storeName)).toBe(legacyGroupOf(storeName));
  });

  it("diverges from the legacy grouping only for the documented overrides", () => {
    const diverging = realStoreNames.filter(
      (name) => suggestStoreGroup(name) !== legacyGroupOf(name)
    );
    expect(diverging.map((name) => name.trim().toLowerCase()).sort()).toEqual(
      [...OVERRIDDEN_STORE_NAMES].sort()
    );
  });

  // "NÁ" carries nothing Coop-ish in its name, so only the override can put it
  // in the Coop block - on the entry grid and on the kitchen printout alike.
  it("puts NÁ in the Coop group by explicit override", () => {
    expect(legacyGroupOf("NÁ")).toBe("EGYEB");
    expect(suggestStoreGroup("NÁ")).toBe("COOP");
    expect(suggestStoreGroup(" ná ")).toBe("COOP");
  });

  // The one case where group precedence actually matters: a Coop-prefixed name
  // that is really on the countryside round. Vidék must win.
  it("classifies COOP MÓRA as VIDEK, not COOP", () => {
    expect(suggestStoreGroup("COOP MÓRA")).toBe("VIDEK");
  });

  it("is case- and whitespace-insensitive on the vidék list", () => {
    expect(suggestStoreGroup("  kisszállás ")).toBe("VIDEK");
    expect(suggestStoreGroup("Omv")).toBe("VIDEK");
  });

  it("groups FAV and Coop prefixes regardless of casing", () => {
    expect(suggestStoreGroup("FAV Mars")).toBe("FAV");
    expect(suggestStoreGroup("Fav vedres")).toBe("FAV");
    expect(suggestStoreGroup("Coop 116")).toBe("COOP");
  });

  // \b means the prefix has to be a whole word - "Favorit Kft" is not a FAV
  // store, and neither is "Coopers".
  it("requires a word boundary after the prefix", () => {
    expect(suggestStoreGroup("Favorit Kft")).toBe("EGYEB");
    expect(suggestStoreGroup("Coopers")).toBe("EGYEB");
  });

  it("falls back to EGYEB for ordinary names", () => {
    expect(suggestStoreGroup("Doma")).toBe("EGYEB");
    expect(suggestStoreGroup("Székelysor")).toBe("EGYEB");
  });
});

describe("compareStoresForGrid", () => {
  const store = (storeName: string, storeGroup: StoreGroup, storeOrder: number) => ({
    storeName,
    storeGroup,
    storeOrder,
  });

  it("orders by group first, per STORE_GROUP_ORDER", () => {
    const sorted = [
      store("V", "VIDEK", 0),
      store("E", "EGYEB", 0),
      store("C", "COOP", 0),
      store("F", "FAV", 0),
    ].sort(compareStoresForGrid);
    expect(sorted.map((s) => s.storeGroup)).toEqual(STORE_GROUP_ORDER);
  });

  it("orders by storeOrder within a group", () => {
    const sorted = [
      store("harmadik", "FAV", 3),
      store("elso", "FAV", 1),
      store("masodik", "FAV", 2),
    ].sort(compareStoresForGrid);
    expect(sorted.map((s) => s.storeName)).toEqual(["elso", "masodik", "harmadik"]);
  });

  it("falls back to Hungarian collation when storeOrder ties", () => {
    const sorted = [store("Zebra", "EGYEB", 0), store("Álom", "EGYEB", 0)].sort(
      compareStoresForGrid
    );
    expect(sorted.map((s) => s.storeName)).toEqual(["Álom", "Zebra"]);
  });
});

describe("groupStoresForGrid", () => {
  it("omits empty groups", () => {
    const blocks = groupStoresForGrid([
      { storeName: "Doma", storeGroup: "EGYEB", storeOrder: 1 },
      { storeName: "FAV Mars", storeGroup: "FAV", storeOrder: 2 },
    ]);
    expect(blocks.map((b) => b.group)).toEqual(["FAV", "EGYEB"]);
  });

  it("puts vidék last so it renders as its own separate block", () => {
    const blocks = groupStoresForGrid([
      { storeName: "KISSZÁLLÁS", storeGroup: "VIDEK", storeOrder: 1 },
      { storeName: "Coop 116", storeGroup: "COOP", storeOrder: 2 },
    ]);
    expect(blocks.map((b) => b.group)).toEqual(["COOP", "VIDEK"]);
  });

  it("does not mutate its input", () => {
    const stores = [
      { storeName: "B", storeGroup: "VIDEK" as StoreGroup, storeOrder: 2 },
      { storeName: "A", storeGroup: "FAV" as StoreGroup, storeOrder: 1 },
    ];
    groupStoresForGrid(stores);
    expect(stores.map((s) => s.storeName)).toEqual(["B", "A"]);
  });
});
