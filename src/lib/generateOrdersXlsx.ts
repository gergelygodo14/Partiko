import ExcelJS from "exceljs";
import type { OrderDayQuantities } from "@/lib/orders";
import type { DishNames } from "@/lib/ordersSummary";

export type KitchenReportRow = { storeName: string } & OrderDayQuantities;

const MAX_SHEET_NAME_LENGTH = 31;

function formatCell(normal: number, xl: number): string | number {
  if (normal === 0 && xl === 0) return "";
  if (xl === 0) return normal;
  if (normal === 0) return `+${xl} XL`;
  return `${normal} (+${xl} XL)`;
}

// Vertical (column) borders thick, horizontal (row) borders thin - printed
// on a blank A4 sheet, this reads as a clear grid without relying on
// Excel's (non-printing) gridlines.
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

export async function generateOrdersXlsx(
  date: string,
  dayName: string,
  dishNames: DishNames | null,
  totals: OrderDayQuantities,
  byCustomer: KitchenReportRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = `KAJA ${dayName || date}`.slice(0, MAX_SHEET_NAME_LENGTH);
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: dayName || date, key: "storeName", width: 22 },
    { header: dishNames?.a ?? "A", key: "a", width: 38 },
    { header: dishNames?.b ?? "B", key: "b", width: 38 },
    { header: dishNames?.c ?? "C", key: "c", width: 38 },
    { header: "Összesen", key: "total", width: 12 },
  ];

  // A4 printout: dish names can be long, so let the header row wrap to two
  // lines instead of getting cut off, and scale the sheet to one page wide.
  sheet.getRow(1).height = 34;
  sheet.getRow(1).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  byCustomer.forEach((row) => {
    sheet.addRow({
      storeName: row.storeName,
      a: formatCell(row.a, row.aXl),
      b: formatCell(row.b, row.bXl),
      c: formatCell(row.c, row.cXl),
      total: row.a + row.aXl + row.b + row.bXl + row.c + row.cXl,
    });
  });

  sheet.addRow({
    storeName: "Összesen",
    a: formatCell(totals.a, totals.aXl),
    b: formatCell(totals.b, totals.bXl),
    c: formatCell(totals.c, totals.cXl),
    total: totals.a + totals.aXl + totals.b + totals.bXl + totals.c + totals.cXl,
  });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(sheet.rowCount).font = { bold: true };

  applyGridBorders(sheet, sheet.columns.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
