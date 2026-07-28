import ExcelJS from "exceljs";
import type { SandwichDailyItemTotal } from "@/lib/sandwichOrdersSummary";
import { EXCEL_LABEL_BY_ITEM_NAME } from "@/lib/generateSandwichOrdersXlsx";

const MAX_SHEET_NAME_LENGTH = 31;

// Matches the reference sheet's "összesítés" tab exactly: item name in
// large bold italic Arial (its own shorthand, same as the kitchen export),
// one quantity column per item, no header row, no store breakdown, no
// prices - verified cell-by-cell (font/size/order) against that tab. Always
// lists the full catalog, including items with a 0 that day - the owner
// wants to see every sandwich at a glance, not just the ones ordered.
const ITEM_FONT = { name: "Arial", bold: true, italic: true, size: 16 };
const QTY_FONT = { name: "Comic Sans MS", bold: true, size: 11 };

export async function generateSandwichDailySummaryXlsx(
  date: string,
  dayName: string,
  items: SandwichDailyItemTotal[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = `SZ ÖSSZESÍTÉS ${dayName || date}`.slice(0, MAX_SHEET_NAME_LENGTH);
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { key: "itemName", width: 26, style: { font: ITEM_FONT } },
    {
      key: "quantity",
      width: 10,
      style: { font: QTY_FONT, alignment: { horizontal: "center" as const } },
    },
  ];

  const sorted = [...items].sort(
    (a, b) => a.itemOrder - b.itemOrder || a.itemName.localeCompare(b.itemName, "hu")
  );
  sorted.forEach((item) => {
    sheet.addRow({
      itemName: EXCEL_LABEL_BY_ITEM_NAME[item.itemName] ?? item.itemName,
      quantity: item.quantity,
    });
  });

  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 2; c++) {
      sheet.getRow(r).getCell(c).border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }

  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
