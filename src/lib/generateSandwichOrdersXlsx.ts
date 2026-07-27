import ExcelJS from "exceljs";
import type { SandwichDayCustomerOrder } from "@/lib/sandwichOrdersSummary";

const MAX_SHEET_NAME_LENGTH = 31;

// Matches the kitchen's own hand-built reference sheet
// (partiko-szendvics/reference/rendelések.xlsx, KEDD tab) so the printed
// export looks like what they're already used to: item names in Arial
// bold italic, store names/quantities in Comic Sans MS bold.
const ITEM_FONT = { name: "Arial", bold: true, italic: true, size: 12 };
const DATA_FONT = { name: "Comic Sans MS", bold: true, size: 11 };

// The reference sheet's own row labels (exact case, its internal shorthand)
// rather than the nicer full catalog name used everywhere else in the app -
// the owner asked for the kitchen printout specifically to read exactly like
// what they already hand-write, not the customer-facing product names.
const EXCEL_LABEL_BY_ITEM_NAME: Record<string, string> = {
  "Sonkás bagel": "BAGEL",
  "Fasírtos-pfefferonis szendvics": "fasírtos-pfeff",
  "Grillezett csirkemell papucs": "grill papucs",
  "Hamburger": "hamburger",
  "Molnárka (kicsi) kolbászos": "molnárka,kolb",
  "Molnárka (kicsi) sonkás": "molnárka,sonkás",
  "Molnárka (kicsi) szalámis": "molnárka szalámis",
  "Csirkemelles bigkifli": "BIGKIFLI",
  "Fetasajtos bigkifli": "BIGKIFLI fetás",
  "Nagyi kifli": "nagyi",
  "Pleskavica": "pleskavica",
  "Dupla szalámis pogácsa": "pogácsa",
  "Rántott húsos vekni": "rántott húsos",
  "Rántott húsos vekni (teljes kiőrlésű)": "RHZS TK",
  "Sajtburger": "sajtburger",
  "Rántott húsos papucs": "RHZS PAPUCS",
  "Dupla sajtburger": "DUPLA SAJTBURG",
  "Mini burger": "miniburger",
  "Pötyi pogi (dupla rántott húsos pogácsa)": "PÖTYI",
  "Csirkés tortilla": "TORTILLA",
  "Extra szendvics": "EXTRA",
  "Mediterrán karajos vekni": "Karajos vekni",
  "Szegedi sonkás vekni": "Szegedi sonkás",
  "Piccante szalámis (olasz, csípős)": "PICCANTE",
  "Csirkés panini": "Csirkés panini",
  "Tépett húsos szendvics": "Tépett húsos",
};

// The reference sheet draws a thick horizontal rule after these catalog
// `order` values (its own hand-drawn grouping of similar items - e.g. all
// the molnárka/bigkifli variants together, all the rántott húsos variants
// together) - 6 rules, verified cell-by-cell against the KEDD tab.
const GROUP_DIVIDER_AFTER_ORDER = new Set([4, 9, 12, 17, 21, 24]);

// A handful of extra blank store-columns for stores that phoned in an order
// too late to be in the system - deliberately small (unlike the ready-meal
// sheet's MIN_PRINTABLE_ROWS padding, which pads the cheap, unbounded-length
// axis). Here columns are the unbounded axis on a landscape page, so heavy
// padding would eat directly into the page's limited width budget instead
// of just extending the sheet downward.
const EXTRA_BLANK_STORE_COLUMNS = 4;

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
  for (let i = 0; i < EXTRA_BLANK_STORE_COLUMNS; i++) {
    columns.push({ header: "", key: `blank${i}`, width: 14, style: centered });
  }
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
      itemName: EXCEL_LABEL_BY_ITEM_NAME[item.name] ?? item.name,
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
  rows: SandwichDayCustomerOrder[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Union of items that actually appear today, sorted by catalog order -
  // not a static full-catalog scan, mirrors how the ready-meal export only
  // shows dishes actually configured for the day rather than the whole menu.
  const itemMap = new Map<string, Item>();
  for (const row of rows) {
    for (const line of row.lines) {
      if (!itemMap.has(line.itemId)) {
        itemMap.set(line.itemId, { itemId: line.itemId, name: line.itemName, order: line.itemOrder });
      }
    }
  }
  const items = Array.from(itemMap.values()).sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "hu")
  );

  // Chunk stores into as many sheets as needed so each one still prints
  // readably on one A4 landscape page - not just a single split into two,
  // since a big enough day would still overflow a second sheet too. 8
  // stores (+ the blank phone-order columns) is about what still prints
  // readably on one page.
  const STORES_PER_SHEET = 8;
  const label = dayName || date;
  const sheetCount = Math.max(1, Math.ceil(rows.length / STORES_PER_SHEET));
  for (let i = 0; i < sheetCount; i++) {
    const chunk = rows.slice(i * STORES_PER_SHEET, (i + 1) * STORES_PER_SHEET);
    buildSheet(workbook, `SZENDVICS ${label} ${i + 1}`, label, items, chunk);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
