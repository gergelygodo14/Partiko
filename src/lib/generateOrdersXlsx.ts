import ExcelJS from "exceljs";
import type { OrderDayQuantities } from "@/lib/orders";
import type { CustomerDayOrderRow } from "@/lib/ordersSummary";

export async function generateOrdersXlsx(
  date: string,
  totals: OrderDayQuantities,
  byCustomer: CustomerDayOrderRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Rendelések ${date}`);
  sheet.columns = [
    { header: "Üzlet", key: "storeName", width: 24 },
    { header: "Cégnév", key: "companyName", width: 24 },
    { header: "A", key: "a", width: 8 },
    { header: "B", key: "b", width: 8 },
    { header: "C", key: "c", width: 8 },
    { header: "Összesen", key: "total", width: 10 },
  ];

  byCustomer.forEach((row) => {
    sheet.addRow({
      storeName: row.storeName,
      companyName: row.companyName,
      a: row.a,
      b: row.b,
      c: row.c,
      total: row.a + row.b + row.c,
    });
  });

  sheet.addRow({
    storeName: "Összesen",
    companyName: "",
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
