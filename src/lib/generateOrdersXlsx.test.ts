import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateOrdersXlsx } from "@/lib/generateOrdersXlsx";

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("generateOrdersXlsx", () => {
  it("produces a valid xlsx (zip) buffer with a sheet named after the date", async () => {
    const buffer = await generateOrdersXlsx("2026-07-06", { a: 0, b: 0, c: 0 }, []);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");

    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("Rendelések 2026-07-06")).toBeDefined();
  });

  it("lists per-customer quantities with a row total, then a grand-total row", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      { a: 3, b: 5, c: 1 },
      [
        { customerId: "c1", storeName: "Alma Büfé", companyName: "Alma Kft.", a: 2, b: 0, c: 1 },
        { customerId: "c2", storeName: "Zöld Bolt", companyName: "Zöld Kft.", a: 1, b: 5, c: 0 },
      ]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("Rendelések 2026-07-06")!;

    expect(sheet.getRow(2).getCell(1).value).toBe("Alma Büfé");
    expect(sheet.getRow(2).getCell(3).value).toBe(2); // A
    expect(sheet.getRow(2).getCell(5).value).toBe(1); // C
    expect(sheet.getRow(2).getCell(6).value).toBe(3); // row total

    expect(sheet.getRow(3).getCell(1).value).toBe("Zöld Bolt");
    expect(sheet.getRow(3).getCell(6).value).toBe(6); // row total

    expect(sheet.getRow(4).getCell(1).value).toBe("Összesen");
    expect(sheet.getRow(4).getCell(3).value).toBe(3); // grand total A
    expect(sheet.getRow(4).getCell(4).value).toBe(5); // grand total B
    expect(sheet.getRow(4).getCell(6).value).toBe(9); // grand total row sum
  });

  it("still produces a valid, empty sheet when nothing was ordered", async () => {
    const buffer = await generateOrdersXlsx("2026-07-05", { a: 0, b: 0, c: 0 }, []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("Rendelések 2026-07-05")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Összesen");
  });
});
