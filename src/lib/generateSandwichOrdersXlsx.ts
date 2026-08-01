import ExcelJS from "exceljs";
import type { SandwichDayCustomerOrder } from "@/lib/sandwichOrdersSummary";
import { excelLabelFor } from "@/lib/sandwichItemLabels";

// Re-exported from its own module so client components can use the labels
// without pulling exceljs into the browser bundle.
export { EXCEL_LABEL_BY_ITEM_NAME } from "@/lib/sandwichItemLabels";

const MAX_SHEET_NAME_LENGTH = 31;

// Matches the kitchen's own hand-built reference sheet
// (partiko-szendvics/reference/rendelések.xlsx, KEDD tab) so the printed
// export looks like what they're already used to: item names in Arial
// bold italic, store names/quantities in Comic Sans MS bold.
const ITEM_FONT = { name: "Arial", bold: true, italic: true, size: 12 };
const DATA_FONT = { name: "Comic Sans MS", bold: true, size: 11 };

// The reference sheet draws a thick horizontal rule after these catalog
// `order` values (its own hand-drawn grouping of similar items - e.g. all
// the molnárka/bigkifli variants together, all the rántott húsos variants
// together) - 6 rules, verified cell-by-cell against the KEDD tab.
const GROUP_DIVIDER_AFTER_ORDER = new Set([4, 9, 12, 17, 21, 24]);

// Thin grid throughout, with a thick rule under the header row and under
// each group boundary - same border convention as the reference sheet.
function applyGridBorders(
  sheet: ExcelJS.Worksheet,
  columnCount: number,
  thickAfterRow: (row: number) => boolean
) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= columnCount; c++) {
      sheet.getRow(r).getCell(c).border = {
        top: { style: "thin" },
        bottom: { style: r === 1 || thickAfterRow(r) ? "thick" : "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function quantityFor(row: SandwichDayCustomerOrder, itemId: string): number {
  return row.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
}

// Keeps every Coop store next to every other Coop store, since the owner
// packs those together for the same run - a stable group-by that otherwise
// preserves the incoming biggest-orderer-first order untouched. FAV rows are
// filtered out by the caller before this runs (they get their own sheet
// entirely, see generateSandwichOrdersXlsx below) - this still groups FAV
// too if ever called with FAV rows in it (exercised directly by the parity
// test), it's just that the export itself no longer does.
//
// Reads Customer.storeGroup rather than re-deriving the group from the store
// name (which is what this did before that column existed). Only the group KEY
// changed; the first-appearance bucket ordering is deliberately identical, and
// Customer.storeOrder is deliberately NOT consulted - either would change the
// printed sheet. Parity with the old name-regex version is asserted in
// generateSandwichOrdersXlsx.test.ts.
export function groupAdjacentByStoreGroup(
  rows: SandwichDayCustomerOrder[]
): SandwichDayCustomerOrder[] {
  function groupKey(row: SandwichDayCustomerOrder): string {
    // EGYEB stays ungrouped (unique key per store) - identical to the old
    // regex fall-through, which returned row.customerId.
    return row.storeGroup === "EGYEB" ? row.customerId : row.storeGroup;
  }
  const buckets = new Map<string, SandwichDayCustomerOrder[]>();
  const firstSeenOrder: string[] = [];
  for (const row of rows) {
    const key = groupKey(row);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      firstSeenOrder.push(key);
    }
    buckets.get(key)!.push(row);
  }
  return firstSeenOrder.flatMap((key) => buckets.get(key)!);
}

type Item = { itemId: string; name: string; order: number };

// One printable A4-landscape page for a subset of stores - split out so a
// busy day (many stores) becomes two narrower sheets instead of one sheet
// squeezed illegibly small to fit-to-width.
function buildSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columnHeaderLabel: string,
  items: Item[],
  rows: SandwichDayCustomerOrder[]
) {
  const sheet = workbook.addWorksheet(sheetName.slice(0, MAX_SHEET_NAME_LENGTH));

  const centered = { alignment: { horizontal: "center" as const }, font: DATA_FONT };
  const itemNameStyle = { font: ITEM_FONT };

  const columns: Partial<ExcelJS.Column>[] = [
    { header: columnHeaderLabel, key: "itemName", width: 30, style: itemNameStyle },
  ];
  // rows arrives pre-sorted biggest-orderer-first (see getSandwichOrdersForDay).
  rows.forEach((row) => {
    columns.push({ header: row.storeName, key: row.customerId, width: 14, style: centered });
  });
  columns.push({ header: "Összesen", key: "total", width: 10, style: centered });
  sheet.columns = columns;

  // Store names can be long; let the header wrap instead of getting cut off
  // (Excel auto-sizes the row height to fit).
  sheet.getRow(1).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    // Opposite choice from the ready-meal sheet on purpose: there the risk
    // was an already-narrow table getting stretched wide, here it's an
    // already-wide (many stores) table needing to be compressed to fit one
    // page's width on a busy day.
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    // The item-name column repeats on every printed page if a very busy day
    // still spills past one landscape page width.
    printTitlesColumn: "A:A",
  };

  items.forEach((item) => {
    const rowData: Record<string, string | number> = {
      itemName: excelLabelFor(item.name),
    };
    let itemTotal = 0;
    rows.forEach((row) => {
      const qty = quantityFor(row, item.itemId);
      rowData[row.customerId] = qty === 0 ? "" : qty;
      itemTotal += qty;
    });
    rowData.total = itemTotal;
    sheet.addRow(rowData);
  });

  const totalsRowData: Record<string, string | number> = { itemName: "Összesen" };
  let grandTotal = 0;
  rows.forEach((row) => {
    totalsRowData[row.customerId] = row.totalQuantity;
    grandTotal += row.totalQuantity;
  });
  totalsRowData.total = grandTotal;
  sheet.addRow(totalsRowData);
  const totalsRow = sheet.getRow(sheet.rowCount);

  // Item rows start at sheet row 2 (row 1 is the header); a divider drawn
  // "after" a given item lands on that same item's own row (its bottom
  // border), matching how the reference sheet places its thick rules.
  applyGridBorders(sheet, sheet.columns.length, (r) => {
    const item = items[r - 2];
    return item !== undefined && GROUP_DIVIDER_AFTER_ORDER.has(item.order);
  });
  // Thick top border sets the totals row apart from the item rows above it.
  for (let c = 1; c <= sheet.columns.length; c++) {
    const cell = totalsRow.getCell(c);
    cell.border = { ...cell.border, top: { style: "thick" } };
  }
}

// Rotated from the ready-meal kitchen sheet: sandwiches (the near-fixed,
// slow-growing axis) go down the rows, stores (the variable, unbounded
// axis) go across the columns, A4 landscape. Quantities only, no
// prices/totals in Ft (confirmed with the owner - matches the ready-meal
// kitchen sheet's own "no pricing" convention).
export async function generateSandwichOrdersXlsx(
  date: string,
  dayName: string,
  rows: SandwichDayCustomerOrder[],
  catalogItems: Item[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // The full active catalog, not just items actually ordered that day - the
  // owner wants every sandwich listed on the printout every time, even ones
  // at 0, not just whatever happened to be ordered.
  const items = [...catalogItems].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "hu")
  );

  // Countryside ("vidék") stores go out with a different driver, so they
  // must never share a page with an in-town store - pulled out into their
  // own dedicated sheet(s) entirely, before any other grouping/splitting.
  // FAV stores get the same treatment (2026-08-01, owner request) - they used
  // to just be grouped adjacent within the regular sheet(s), but the owner
  // packs FAV stores as a fully separate run, same as vidék.
  const videkRows = rows.filter((row) => row.storeGroup === "VIDEK");
  const favRows = rows.filter((row) => row.storeGroup === "FAV");
  const regularRows = groupAdjacentByStoreGroup(
    rows.filter((row) => row.storeGroup !== "VIDEK" && row.storeGroup !== "FAV")
  );

  // Chunk stores into as many sheets as needed so each one still prints
  // readably on one A4 landscape page - not just a single split into two,
  // since a big enough day would still overflow a second sheet too. 12
  // stores (+ the blank phone-order columns) is about what still prints
  // readably on one page (raised from 8 on 2026-08-01 - there was still
  // room).
  const STORES_PER_SHEET = 12;
  const label = dayName || date;
  const sheetCount = Math.max(1, Math.ceil(regularRows.length / STORES_PER_SHEET));
  for (let i = 0; i < sheetCount; i++) {
    const chunk = regularRows.slice(i * STORES_PER_SHEET, (i + 1) * STORES_PER_SHEET);
    buildSheet(workbook, `SZENDVICS ${label} ${i + 1}`, label, items, chunk);
  }

  if (favRows.length > 0) {
    const favSheetCount = Math.ceil(favRows.length / STORES_PER_SHEET);
    for (let i = 0; i < favSheetCount; i++) {
      const chunk = favRows.slice(i * STORES_PER_SHEET, (i + 1) * STORES_PER_SHEET);
      const suffix = favSheetCount > 1 ? ` ${i + 1}` : "";
      buildSheet(workbook, `SZENDVICS ${label} FAV${suffix}`, label, items, chunk);
    }
  }

  if (videkRows.length > 0) {
    const videkSheetCount = Math.ceil(videkRows.length / STORES_PER_SHEET);
    for (let i = 0; i < videkSheetCount; i++) {
      const chunk = videkRows.slice(i * STORES_PER_SHEET, (i + 1) * STORES_PER_SHEET);
      const suffix = videkSheetCount > 1 ? ` ${i + 1}` : "";
      buildSheet(workbook, `SZENDVICS ${label} VIDÉK${suffix}`, label, items, chunk);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
