import ExcelJS from "exceljs";
import type { OrderDayQuantities } from "@/lib/orders";
import type { DishNames } from "@/lib/ordersSummary";

export type KitchenReportRow = { storeName: string } & OrderDayQuantities;

const MAX_SHEET_NAME_LENGTH = 31;

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
    { header: "Üzlet", key: "storeName", width: 24 },
    { header: dishNames?.a ?? "A", key: "a", width: 18 },
    { header: dishNames?.b ?? "B", key: "b", width: 18 },
    { header: dishNames?.c ?? "C", key: "c", width: 18 },
    { header: "Összesen", key: "total", width: 10 },
  ];

  byCustomer.forEach((row) => {
    sheet.addRow({
      storeName: row.storeName,
      a: row.a,
      b: row.b,
      c: row.c,
      total: row.a + row.b + row.c,
    });
  });

  sheet.addRow({
    storeName: "Összesen",
    a: totals.a,
    b: totals.b,
    c: totals.c,
    total: totals.a + totals.b + totals.c,
  });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(sheet.rowCount).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
