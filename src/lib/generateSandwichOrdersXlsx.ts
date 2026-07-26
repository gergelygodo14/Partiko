import ExcelJS from "exceljs";
import type { SandwichDayCustomerOrder } from "@/lib/sandwichOrdersSummary";

const MAX_SHEET_NAME_LENGTH = 31;
const FONT_SIZE = 14;

// A handful of extra blank store-columns for stores that phoned in an order
// too late to be in the system - deliberately small (unlike the ready-meal
// sheet's MIN_PRINTABLE_ROWS padding, which pads the cheap, unbounded-length
// axis). Here columns are the unbounded axis on a landscape page, so heavy
// padding would eat directly into the page's limited width budget instead
// of just extending the sheet downward.
const EXTRA_BLANK_STORE_COLUMNS = 4;

// Vertical (column) borders thick, horizontal (row) borders thin - same
// convention as the ready-meal export, reimplemented independently here so
// this file never needs to import from (or risk changing) that one.
function applyGridBorders(sheet: ExcelJS.Worksheet, columnCount: number) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= columnCount; c++) {
      sheet.getRow(r).getCell(c).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "medium" },
        right: { style: "medium" },
      };
    }
  }
}

function quantityFor(row: SandwichDayCustomerOrder, itemId: string): number {
  return row.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
}

// Rotated from the ready-meal kitchen sheet: sandwiches (the near-fixed,
// slow-growing axis) go down the rows, stores (the variable, unbounded
// axis) go across the columns, A4 landscape. Quantities only, no
// prices/totals in Ft (confirmed with the owner - matches the ready-meal
// kitchen sheet's own "no pricing" convention).
export async function generateSandwichOrdersXlsx(
  date: string,
  dayName: string,
  rows: SandwichDayCustomerOrder[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = `SZENDVICS ${dayName || date}`.slice(0, MAX_SHEET_NAME_LENGTH);
  const sheet = workbook.addWorksheet(sheetName);

  // Union of items that actually appear today, sorted by catalog order -
  // not a static full-catalog scan, mirrors how the ready-meal export only
  // shows dishes actually configured for the day rather than the whole menu.
  const itemMap = new Map<string, { name: string; order: number }>();
  for (const row of rows) {
    for (const line of row.lines) {
      if (!itemMap.has(line.itemId)) {
        itemMap.set(line.itemId, { name: line.itemName, order: line.itemOrder });
      }
    }
  }
  const items = Array.from(itemMap.entries())
    .map(([itemId, info]) => ({ itemId, ...info }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "hu"));

  const centered = { alignment: { horizontal: "center" as const }, font: { size: FONT_SIZE } };
  const itemNameStyle = { font: { size: FONT_SIZE, bold: true } };

  const columns: Partial<ExcelJS.Column>[] = [
    { header: dayName || date, key: "itemName", width: 30, style: itemNameStyle },
  ];
  // rows arrives pre-sorted biggest-orderer-first (see getSandwichOrdersForDay).
  rows.forEach((row) => {
    columns.push({ header: row.storeName, key: row.customerId, width: 14, style: centered });
  });
  for (let i = 0; i < EXTRA_BLANK_STORE_COLUMNS; i++) {
    columns.push({ header: "", key: `blank${i}`, width: 14, style: centered });
  }
  columns.push({ header: "Összesen", key: "total", width: 10, style: centered });
  sheet.columns = columns;

  // Store names can be long; let the header wrap instead of getting cut off
  // (Excel auto-sizes the row height to fit).
  sheet.getRow(1).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  sheet.getRow(1).font = { bold: true, size: FONT_SIZE };
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
    const rowData: Record<string, string | number> = { itemName: item.name };
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
  totalsRow.font = { bold: true, size: FONT_SIZE };

  applyGridBorders(sheet, sheet.columns.length);
  // Thick top border sets the totals row apart from the item rows above it.
  for (let c = 1; c <= sheet.columns.length; c++) {
    const cell = totalsRow.getCell(c);
    cell.border = { ...cell.border, top: { style: "thick" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
