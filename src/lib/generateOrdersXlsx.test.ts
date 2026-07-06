import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateOrdersXlsx } from "@/lib/generateOrdersXlsx";

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("generateOrdersXlsx", () => {
  it("names the sheet 'KAJA <nap>' and uses the date as a fallback when no day name is given", async () => {
    const buffer = await generateOrdersXlsx("2026-07-06", "", null, { a: 0, b: 0, c: 0 }, []);
    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("KAJA 2026-07-06")).toBeDefined();
  });

  it("uses the real dish names as column headers", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "Csirkemell steak", b: "Mexikói ragu", c: "Toscan penne" },
      { a: 0, b: 0, c: 0 },
      []
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;
    const header = sheet.getRow(1);
    expect(header.getCell(1).value).toBe("Üzlet");
    expect(header.getCell(2).value).toBe("Csirkemell steak");
    expect(header.getCell(3).value).toBe("Mexikói ragu");
    expect(header.getCell(4).value).toBe("Toscan penne");
    expect(header.getCell(5).value).toBe("Összesen");
  });

  it("falls back to A/B/C headers when no dish names are available", async () => {
    const buffer = await generateOrdersXlsx("2026-07-06", "HÉTFŐ", null, { a: 0, b: 0, c: 0 }, []);
    const workbook = await readBack(buffer);
    const header = workbook.getWorksheet("KAJA HÉTFŐ")!.getRow(1);
    expect([header.getCell(2).value, header.getCell(3).value, header.getCell(4).value]).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("lists one row per store (no company column) with a row total, then a grand-total row", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      { a: 3, b: 5, c: 1 },
      [
        { storeName: "Alma Büfé", a: 2, b: 0, c: 1 },
        { storeName: "Zöld Bolt", a: 1, b: 5, c: 0 },
      ]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;

    expect(sheet.getRow(2).getCell(1).value).toBe("Alma Büfé");
    expect(sheet.getRow(2).getCell(2).value).toBe(2);
    expect(sheet.getRow(2).getCell(4).value).toBe(1);
    expect(sheet.getRow(2).getCell(5).value).toBe(3); // row total

    expect(sheet.getRow(3).getCell(1).value).toBe("Zöld Bolt");
    expect(sheet.getRow(3).getCell(5).value).toBe(6);

    expect(sheet.getRow(4).getCell(1).value).toBe("Összesen");
    expect(sheet.getRow(4).getCell(2).value).toBe(3);
    expect(sheet.getRow(4).getCell(3).value).toBe(5);
    expect(sheet.getRow(4).getCell(5).value).toBe(9);
  });

  it("still produces a valid, empty sheet when nothing was ordered", async () => {
    const buffer = await generateOrdersXlsx("2026-07-05", "VASÁRNAP", null, { a: 0, b: 0, c: 0 }, []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA VASÁRNAP")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Összesen");
  });
});
