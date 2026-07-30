import { EXCEL_LABEL_BY_ITEM_NAME } from "@/lib/sandwichItemLabels";

// Static description of the kitchen's reference workbook
// (partiko-szendvics/reference/rendelések.xlsx): which tabs belong to which
// weekday, and how its hand-written store names map onto Customer.storeName.
//
// Lives here rather than inside scripts/extract-fix-orders.ts so the
// extraction can be regression-tested (see sandwichFixOrderSource.test.ts,
// which re-derives the Monday reference table from the extracted JSON and
// demands an exact match).

export const SHEETS_BY_WEEKDAY: Record<number, string[]> = {
  // Note the leading space in " HÉTFŐ FAVORIT" and the trailing one in
  // "SZERDA VIDÉK " - both are real, and getWorksheet() is exact-match.
  0: [" HÉTFŐ FAVORIT", "HÉTFŐ1", "HÉTFŐ2", "HÉTFŐ DU VIDÉK"],
  1: ["KEDD", "KEDD (2)"],
  2: ["SZERDA", "SZERDA (2)", "SZERDA VIDÉK "],
  3: ["CSÜT", "CSÜT (2)"],
  4: ["PÉNTEK", "PÉNTEK (2)"],
};

// Raw workbook store name -> the canonical Customer.storeName it belongs to.
//
// The workbook predates the app, so its names are neither the app's nor
// internally consistent: the same store is "Dettre" on the Monday tab, "Dettre
// FAV" on Tuesday and "DETTRE FAV" on Friday. The canonical values on the
// right are the actual Customer.storeName values in the database (verified
// against which customers carry real SandwichOrder rows), NOT the keys of
// mondayReferenceOrders.ts, which were extracted from this same workbook and
// share its naming.
//
// Ambiguities resolved with the owner (2026-07-30):
//   - "ÁG U." / "ÁG U. FAV" both -> "Fav Ág u" (two customers exist and both
//     order; the FAV one is the sandwich store)
//   - "Doma" / "Doma FAV" both -> "FAv doma" (the plain "Doma" customer is a
//     typo duplicate with no sandwich orders)
//   - "OMW" -> "OMV" (the workbook's spelling is the typo, not the app's)
//   - KISSZÁLLÁS / Ital depó / Coop Retek have no customer yet and are to be
//     created by the importer.
export const RAW_STORE_ALIASES: Record<string, string> = {
  // FAV round - the workbook writes the FAV qualifier before or after the
  // name, or omits it entirely, depending on the tab.
  "Doma": "FAv doma",
  "Doma FAV": "FAv doma",
  "Dettre": "FAV dettre",
  "Dettre FAV": "FAV dettre",
  "DETTRE FAV": "FAV dettre",
  "Kukovecz": "Fav kukovecz",
  "Kukovecz FAV": "Fav kukovecz",
  "Vedres": "Fav vedres",
  "Vedres FAV": "Fav vedres",
  "Vadas- park": "Fav Vadaspark",
  "CSILLAG": "Fav Csillag",
  "CSILLAG FAV": "Fav Csillag",
  "MARS": "FAV Mars",
  "Mars FAV": "FAV Mars",
  "DESZK": "Fav Deszk",
  "Deszk FAV": "Fav Deszk",
  "Röszke": "Fav Röszke",
  "Röszke FAV": "Fav Röszke",
  "Retek": "Fav Retek",
  "Retek FAV": "Fav Retek",
  "Szőreg FAV": "Fav szőreg",
  "ÁG U.": "Fav Ág u",
  "ÁG U. FAV": "Fav Ág u",
  "MIHÁLY TELEK": "Fav Szentmihály",

  // Coop round
  "Coop 103": "Coop 103",
  "Coop 116": "Coop 116",
  "Coop Zsombó": "Coop Zsombó",
  "Coop Retek": "Coop Retek", // új bolt

  // Vidék round
  "COOP MÓRA": "coop móra",
  "HATÁR": "határ",
  "KIRÁLY ZSÓKA": "király zsóka",
  "OMW": "OMV",
  "KISSZÁLLÁS": "KISSZÁLLÁS", // új bolt

  // In-town, ungrouped. "CSIRKE 10db" carries a quantity annotation in the
  // name cell, not a second name word.
  "NÁ": "NÁ",
  "CSIRKE 10db": "Csirke",
  "CSIRKE 10 db": "Csirke",
  "Székely": "Székelysor",
  "Székelysor": "Székelysor",
  "ÚJ KL": "ÚJ KL",
  "GYEREK KLINIKA": "Gyerekklinika",
  "Smart Market": "Smart",
  "Mars Taxi": "Mars taxi",
  "Ital depó": "Ital depó", // új bolt
  "ZÁKÁNYSZÉK": "Zákányszék",
  "Zákányszék": "Zákányszék",
  "Ruzsa Fincsi": "Ruzsa Fincsi",
  "NS Diszkont": "NS Diszkont",
  "LILIOM ABC": "LILIOM ABC",
  "PETŐFI": "Petőfi",
  "Tisza Palota": "Tisza Palota Pékáru",
};

/** Stores the importer must create because no Customer matches them yet. */
export const NEW_STORE_NAMES = ["KISSZÁLLÁS", "Ital depó", "Coop Retek"];


/** Excel shorthand label -> full catalog item name. The reverse of
 *  EXCEL_LABEL_BY_ITEM_NAME, which the extractor needs because the workbook
 *  stores only the kitchen's shorthand. */
export const ITEM_NAME_BY_EXCEL_LABEL = new Map(
  Object.entries(EXCEL_LABEL_BY_ITEM_NAME).map(([itemName, label]) => [label, itemName])
);

/** The 26 item labels in the exact order the workbook lists them in A4:A29. */
export const EXPECTED_ITEM_LABELS = Object.values(EXCEL_LABEL_BY_ITEM_NAME);
