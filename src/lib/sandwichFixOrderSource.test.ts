import { describe, expect, it } from "vitest";
import extracted from "../../scripts/fix-orders.extracted.json";
import { MONDAY_REFERENCE_ORDERS } from "@/lib/mondayReferenceOrders";
import { EXCEL_LABEL_BY_ITEM_NAME } from "@/lib/sandwichItemLabels";
import {
  EXPECTED_ITEM_LABELS,
  ITEM_NAME_BY_EXCEL_LABEL,
  NEW_STORE_NAMES,
  RAW_STORE_ALIASES,
  SHEETS_BY_WEEKDAY,
} from "@/lib/sandwichFixOrderSource";

type ExtractedLine = { excelLabel: string; itemName: string; quantity: number };
type ExtractedStore = {
  rawName: string;
  storeName: string;
  computedTotal: number;
  sheetTotal: number | null;
  lines: ExtractedLine[];
};

const weekdays = extracted.weekdays as { weekday: number; stores: ExtractedStore[] }[];
const monday = weekdays.find((w) => w.weekday === 0)!;

describe("the extracted JSON is in sync with the source tables", () => {
  it("covers all five weekdays", () => {
    expect(weekdays.map((w) => w.weekday)).toEqual([0, 1, 2, 3, 4]);
    expect(Object.keys(SHEETS_BY_WEEKDAY)).toHaveLength(5);
  });

  it("resolved every store through RAW_STORE_ALIASES", () => {
    const canonical = new Set(Object.values(RAW_STORE_ALIASES));
    for (const weekday of weekdays) {
      for (const store of weekday.stores) {
        expect(RAW_STORE_ALIASES[store.rawName], `raw: ${store.rawName}`).toBe(store.storeName);
        expect(canonical.has(store.storeName)).toBe(true);
      }
    }
  });

  it("only ever used item names from the live catalog's label map", () => {
    const catalogNames = new Set(Object.keys(EXCEL_LABEL_BY_ITEM_NAME));
    for (const weekday of weekdays) {
      for (const store of weekday.stores) {
        for (const line of store.lines) {
          expect(catalogNames.has(line.itemName), `item: ${line.itemName}`).toBe(true);
          expect(ITEM_NAME_BY_EXCEL_LABEL.get(line.excelLabel)).toBe(line.itemName);
        }
      }
    }
  });

  it("has no duplicate store within a weekday", () => {
    for (const weekday of weekdays) {
      const names = weekday.stores.map((s) => s.storeName);
      expect(new Set(names).size, `weekday ${weekday.weekday}`).toBe(names.length);
    }
  });

  it("has no duplicate item within a store", () => {
    for (const weekday of weekdays) {
      for (const store of weekday.stores) {
        const names = store.lines.map((l) => l.itemName);
        expect(new Set(names).size, `${weekday.weekday}/${store.storeName}`).toBe(names.length);
      }
    }
  });

  it("stores only positive integer quantities", () => {
    for (const weekday of weekdays) {
      for (const store of weekday.stores) {
        for (const line of store.lines) {
          expect(Number.isInteger(line.quantity)).toBe(true);
          expect(line.quantity).toBeGreaterThan(0);
        }
      }
    }
  });

  // Oracle #1, re-asserted over the committed artifact: every non-empty column
  // agreed with the workbook's own =SUM() when it was extracted.
  it("matches the workbook's own SUM on every non-empty column", () => {
    let verified = 0;
    for (const weekday of weekdays) {
      for (const store of weekday.stores) {
        const lineTotal = store.lines.reduce((sum, l) => sum + l.quantity, 0);
        expect(lineTotal, `${weekday.weekday}/${store.storeName}`).toBe(store.computedTotal);
        if (store.sheetTotal !== null) {
          expect(store.sheetTotal, `${weekday.weekday}/${store.storeName}`).toBe(lineTotal);
          verified++;
        }
      }
    }
    expect(verified).toBeGreaterThanOrEqual(94);
  });

  it("lists exactly the new stores the importer is allowed to create", () => {
    expect(extracted.newStores).toEqual(NEW_STORE_NAMES);
  });

  it("extracted cleanly, with no warnings", () => {
    expect(extracted.warnings).toEqual([]);
  });

  it("expects the 26 catalog labels in workbook order", () => {
    expect(EXPECTED_ITEM_LABELS).toHaveLength(26);
    expect(new Set(EXPECTED_ITEM_LABELS).size).toBe(26);
  });
});

// Oracle #4, and the strongest one available: MONDAY_REFERENCE_ORDERS was
// hand-extracted from these same Monday tabs in an earlier session and
// independently verified against the sheet's SUM formulas. Re-deriving it from
// scratch here and demanding an exact match catches any error in either the
// sheet parsing or the alias table.
describe("Monday cross-check against the hand-extracted MONDAY_REFERENCE_ORDERS", () => {
  // The hand-extracted table's keys are a mix: mostly the workbook's own store
  // names ("Vedres", "CSILLAG", "OMW"), but the earlier session had already
  // normalized some of them to what are now canonical Customer.storeName values
  // ("Fav vedres", "FAV Mars", "OMV"). Resolve through the alias table, falling
  // back to the key itself, then assert the result really is a canonical name -
  // so a typo still fails rather than sneaking through the fallback.
  const CANONICAL_NAMES = new Set(Object.values(RAW_STORE_ALIASES));
  const canonicalize = (name: string) => RAW_STORE_ALIASES[name] ?? name;

  const referenceByCanonical = new Map<string, Map<string, number>>();
  for (const [rawName, lines] of Object.entries(MONDAY_REFERENCE_ORDERS)) {
    const canonical = canonicalize(rawName);
    if (!referenceByCanonical.has(canonical)) referenceByCanonical.set(canonical, new Map());
    const target = referenceByCanonical.get(canonical)!;
    for (const line of lines) {
      target.set(line.itemName, (target.get(line.itemName) ?? 0) + line.quantity);
    }
  }

  it("resolves every hand-extracted store name to a canonical store", () => {
    const unresolved = Object.keys(MONDAY_REFERENCE_ORDERS).filter(
      (name) => !CANONICAL_NAMES.has(canonicalize(name))
    );
    expect(unresolved).toEqual([]);
  });

  it("covers the same set of Monday stores", () => {
    const fromJson = [...new Set(monday.stores.map((s) => s.storeName))].sort();
    const fromReference = [...referenceByCanonical.keys()].sort();
    expect(fromJson).toEqual(fromReference);
  });

  it.each([...referenceByCanonical.keys()].sort())(
    "reproduces %s's Monday basket exactly",
    (storeName) => {
      const store = monday.stores.find((s) => s.storeName === storeName)!;
      const actual = Object.fromEntries(
        store.lines.map((line) => [line.itemName, line.quantity])
      );
      const expected = Object.fromEntries(referenceByCanonical.get(storeName)!);
      expect(actual).toEqual(expected);
    }
  );
});
