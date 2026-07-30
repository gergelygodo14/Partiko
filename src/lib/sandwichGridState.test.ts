import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  applyTemplates,
  clearColumn,
  diffDirtyStores,
  gridTotals,
  normalizeColumn,
  setQuantity,
  toSavePayload,
} from "@/lib/sandwichGridState";

const ITEMS = [
  { itemId: "i1", price: 800 },
  { itemId: "i2", price: 500 },
];

describe("normalizeColumn", () => {
  it("drops zero, negative and non-finite quantities", () => {
    expect(normalizeColumn({ a: 0, b: 2, c: -1, d: NaN })).toEqual({ b: 2 });
  });

  it("floors fractional quantities", () => {
    expect(normalizeColumn({ a: 2.9 })).toEqual({ a: 2 });
  });

  it("treats undefined as an empty column", () => {
    expect(normalizeColumn(undefined)).toEqual({});
  });
});

describe("diffDirtyStores", () => {
  it("finds nothing when draft equals saved", () => {
    const saved = { c1: { i1: 2 } };
    expect(diffDirtyStores(saved, { c1: { i1: 2 } })).toEqual([]);
  });

  // The case that makes typing-then-deleting safe: a zero and an absent key
  // must not read as a change.
  it("ignores the difference between an explicit zero and an absent item", () => {
    expect(diffDirtyStores({ c1: { i1: 2 } }, { c1: { i1: 2, i2: 0 } })).toEqual([]);
    expect(diffDirtyStores({ c1: {} }, { c1: { i1: 0 } })).toEqual([]);
  });

  it("detects a changed quantity", () => {
    expect(diffDirtyStores({ c1: { i1: 2 } }, { c1: { i1: 3 } })).toEqual(["c1"]);
  });

  it("detects an added and a removed item", () => {
    expect(diffDirtyStores({ c1: { i1: 2 } }, { c1: { i1: 2, i2: 1 } })).toEqual(["c1"]);
    expect(diffDirtyStores({ c1: { i1: 2, i2: 1 } }, { c1: { i1: 2 } })).toEqual(["c1"]);
  });

  // An emptied column must stay dirty - that is the signal that deletes the
  // store's order for the day.
  it("keeps an emptied column dirty", () => {
    expect(diffDirtyStores({ c1: { i1: 2 } }, { c1: {} })).toEqual(["c1"]);
  });

  it("detects a store present on only one side", () => {
    expect(diffDirtyStores({}, { c1: { i1: 1 } })).toEqual(["c1"]);
    expect(diffDirtyStores({ c1: { i1: 1 } }, {})).toEqual(["c1"]);
  });

  it("returns a stable, sorted list", () => {
    expect(diffDirtyStores({}, { z: { i1: 1 }, a: { i1: 1 } })).toEqual(["a", "z"]);
  });
});

describe("applyTemplate", () => {
  it("replaces the column in replace mode", () => {
    const next = applyTemplate({ c1: { i1: 9 } }, "c1", { i2: 3 }, "replace");
    expect(next.c1).toEqual({ i2: 3 });
  });

  it("fills an empty column in onlyEmpty mode", () => {
    const next = applyTemplate({ c1: {} }, "c1", { i2: 3 }, "onlyEmpty");
    expect(next.c1).toEqual({ i2: 3 });
  });

  // The guard that makes the bulk "load all fix orders" button safe to press
  // after some calls have already been recorded by hand.
  it("leaves a non-empty column untouched in onlyEmpty mode", () => {
    const draft = { c1: { i1: 9 } };
    const next = applyTemplate(draft, "c1", { i2: 3 }, "onlyEmpty");
    expect(next).toBe(draft);
  });

  it("treats an all-zero column as empty in onlyEmpty mode", () => {
    const next = applyTemplate({ c1: { i1: 0 } }, "c1", { i2: 3 }, "onlyEmpty");
    expect(next.c1).toEqual({ i2: 3 });
  });

  it("strips zeros coming from the template itself", () => {
    const next = applyTemplate({}, "c1", { i1: 0, i2: 2 }, "replace");
    expect(next.c1).toEqual({ i2: 2 });
  });

  it("does not mutate the input", () => {
    const draft = { c1: { i1: 9 } };
    applyTemplate(draft, "c1", { i2: 3 }, "replace");
    expect(draft).toEqual({ c1: { i1: 9 } });
  });
});

describe("applyTemplates", () => {
  it("applies every store's template", () => {
    const next = applyTemplates({}, { c1: { i1: 1 }, c2: { i2: 2 } }, "replace");
    expect(next).toEqual({ c1: { i1: 1 }, c2: { i2: 2 } });
  });

  it("skips already-filled columns in onlyEmpty mode", () => {
    const next = applyTemplates({ c1: { i1: 9 } }, { c1: { i1: 1 }, c2: { i2: 2 } }, "onlyEmpty");
    expect(next).toEqual({ c1: { i1: 9 }, c2: { i2: 2 } });
  });
});

describe("setQuantity", () => {
  it("sets a value", () => {
    expect(setQuantity({}, "c1", "i1", 3).c1).toEqual({ i1: 3 });
  });

  it("removes the key when set to zero", () => {
    expect(setQuantity({ c1: { i1: 3 } }, "c1", "i1", 0).c1).toEqual({});
  });

  it("clamps negatives to zero", () => {
    expect(setQuantity({ c1: { i1: 3 } }, "c1", "i1", -5).c1).toEqual({});
  });

  it("floors fractional input", () => {
    expect(setQuantity({}, "c1", "i1", 2.7).c1).toEqual({ i1: 2 });
  });
});

describe("clearColumn", () => {
  it("empties the column without removing the store", () => {
    const next = clearColumn({ c1: { i1: 3 } }, "c1");
    expect(next.c1).toEqual({});
    expect(Object.keys(next)).toContain("c1");
  });
});

describe("gridTotals", () => {
  it("sums per store, per item and overall", () => {
    const totals = gridTotals(ITEMS, { c1: { i1: 2, i2: 1 }, c2: { i1: 1 } });
    expect(totals.byStore.c1).toEqual({ quantity: 3, valueFt: 2 * 800 + 500 });
    expect(totals.byStore.c2).toEqual({ quantity: 1, valueFt: 800 });
    expect(totals.byItem).toEqual({ i1: 3, i2: 1 });
    expect(totals.totalQuantity).toBe(4);
    expect(totals.totalValueFt).toBe(3 * 800 + 500);
  });

  // Mirrors buildSandwichOrderLines, which drops unknown/archived items
  // server-side - the on-screen total must not promise a value the save won't
  // actually store.
  it("ignores items missing from the catalog", () => {
    const totals = gridTotals(ITEMS, { c1: { i1: 1, ghost: 5 } });
    expect(totals.totalQuantity).toBe(1);
    expect(totals.byItem.ghost).toBeUndefined();
  });

  it("reports an empty column as zero rather than omitting it", () => {
    const totals = gridTotals(ITEMS, { c1: {} });
    expect(totals.byStore.c1).toEqual({ quantity: 0, valueFt: 0 });
  });
});

describe("toSavePayload", () => {
  it("sends only the dirty stores", () => {
    const payload = toSavePayload({ c1: { i1: 2 }, c2: { i2: 1 } }, ["c1"]);
    expect(payload).toEqual([{ customerId: "c1", items: [{ itemId: "i1", quantity: 2 }] }]);
  });

  // How a cleared column is communicated: present, but with no items.
  it("sends an emptied dirty store as an empty items array", () => {
    expect(toSavePayload({ c1: {} }, ["c1"])).toEqual([{ customerId: "c1", items: [] }]);
  });

  it("strips zeros from the payload", () => {
    const payload = toSavePayload({ c1: { i1: 2, i2: 0 } }, ["c1"]);
    expect(payload[0].items).toEqual([{ itemId: "i1", quantity: 2 }]);
  });

  it("sends nothing when nothing is dirty", () => {
    expect(toSavePayload({ c1: { i1: 2 } }, [])).toEqual([]);
  });
});
