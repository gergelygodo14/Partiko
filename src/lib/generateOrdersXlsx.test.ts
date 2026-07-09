import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateOrdersXlsx } from "@/lib/generateOrdersXlsx";

const EMPTY_TOTALS = { a: 0, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 };

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("generateOrdersXlsx", () => {
  it("names the sheet 'KAJA <nap>' and uses the date as a fallback when no day name is given", async () => {
    const buffer = await generateOrdersXlsx("2026-07-06", "", null, EMPTY_TOTALS, []);
    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("KAJA 2026-07-06")).toBeDefined();
  });

  it("puts the day name in the top-left header cell (not 'Üzlet'), and dish names as the other headers", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "Csirkemell steak", b: "Mexikói ragu", c: "Toscan penne" },
      EMPTY_TOTALS,
      []
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;
    const header = sheet.getRow(1);
    expect(header.getCell(1).value).toBe("HÉTFŐ");
    expect(header.getCell(2).value).toBe("Csirkemell steak");
    expect(header.getCell(3).value).toBe("Mexikói ragu");
    expect(header.getCell(4).value).toBe("Toscan penne");
    expect(header.getCell(5).value).toBe("Összesen");
    expect(header.font?.bold).toBe(true);
  });

  it("falls back to the date when no day name is given, and to A/B/C when no dish names exist", async () => {
    const buffer = await generateOrdersXlsx("2026-07-06", "", null, EMPTY_TOTALS, []);
    const workbook = await readBack(buffer);
    const header = workbook.getWorksheet("KAJA 2026-07-06")!.getRow(1);
    expect(header.getCell(1).value).toBe("2026-07-06");
    expect([header.getCell(2).value, header.getCell(3).value, header.getCell(4).value]).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("lists one row per store (no company column) with a row total, then a bold grand-total row at the bottom of the page", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      { a: 3, b: 5, c: 1, aXl: 0, bXl: 0, cXl: 0 },
      [
        { storeName: "Alma Büfé", a: 2, b: 0, c: 1, aXl: 0, bXl: 0, cXl: 0 },
        { storeName: "Zöld Bolt", a: 1, b: 5, c: 0, aXl: 0, bXl: 0, cXl: 0 },
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

    // A blank, handwritable row separates the last order from the totals row.
    expect(sheet.getRow(4).getCell(1).value).toBeFalsy();

    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(1).value).toBe("Összesen");
    expect(totalsRow.getCell(2).value).toBe(3);
    expect(totalsRow.getCell(3).value).toBe(5);
    expect(totalsRow.getCell(5).value).toBe(9);
    expect(totalsRow.font?.bold).toBe(true);
  });

  it("shows XL quantities alongside the normal count in the same cell, included in the row total", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      { a: 3, b: 0, c: 1, aXl: 1, bXl: 2, cXl: 0 },
      [{ storeName: "Alma Büfé", a: 2, b: 0, c: 1, aXl: 1, bXl: 0, cXl: 0 }]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;

    expect(sheet.getRow(2).getCell(2).value).toBe("2 (+1 XL)"); // a=2, aXl=1
    expect(sheet.getRow(2).getCell(3).value).toBe(""); // b=0, bXl=0
    expect(sheet.getRow(2).getCell(5).value).toBe(4); // row total: 2+1+0+0+1+0

    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(2).value).toBe("3 (+1 XL)"); // totals row a
    expect(totalsRow.getCell(3).value).toBe("+2 XL"); // totals row b: 0 normal, 2 XL
  });

  it("still produces a valid, empty sheet when nothing was ordered", async () => {
    const buffer = await generateOrdersXlsx("2026-07-05", "VASÁRNAP", null, EMPTY_TOTALS, []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA VASÁRNAP")!;
    expect(sheet.getRow(sheet.rowCount).getCell(1).value).toBe("Összesen");
  });

  it("pads blank, bordered rows between the orders and the totals row to fill an A4 page for handwriting", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      { a: 1, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 },
      [{ storeName: "Alma Büfé", a: 1, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 }]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;

    expect(sheet.rowCount).toBeGreaterThanOrEqual(40);

    const padRow = sheet.getRow(sheet.rowCount - 1);
    expect(padRow.getCell(1).value).toBeFalsy();
    expect(padRow.getCell(1).border?.left?.style).toBe("medium");
    expect(padRow.getCell(1).border?.top?.style).toBe("thin");

    // The totals row sits at the very bottom, set apart by a thick top border.
    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(1).value).toBe("Összesen");
    expect(totalsRow.font?.bold).toBe(true);
    for (let col = 1; col <= 5; col++) {
      expect(totalsRow.getCell(col).border?.top?.style).toBe("thick");
    }
  });

  it("uses 14pt everywhere, bold store names, and a fixed 100% print scale (not stretched to fill the page width)", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      { a: 1, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 },
      [{ storeName: "Alma Büfé", a: 1, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 }]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;

    expect(sheet.getRow(1).getCell(1).font?.size).toBe(14);
    expect(sheet.getRow(2).getCell(1).font?.size).toBe(14);
    expect(sheet.getRow(2).getCell(1).font?.bold).toBe(true); // store name, bold
    expect(sheet.getRow(2).getCell(2).font?.bold).toBeFalsy(); // dish quantity, not bold
    expect(sheet.getRow(2).getCell(2).font?.size).toBe(14);

    expect(sheet.pageSetup.scale).toBe(100);
    expect(sheet.pageSetup.fitToPage).toBeFalsy();
  });

  it("applies thick vertical / thin horizontal borders to every cell in the table", async () => {
    const buffer = await generateOrdersXlsx(
      "2026-07-06",
      "HÉTFŐ",
      { a: "A", b: "B", c: "C" },
      EMPTY_TOTALS,
      [{ storeName: "Alma Büfé", a: 1, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 }]
    );
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("KAJA HÉTFŐ")!;

    for (const rowNum of [1, 2, 3]) {
      for (let col = 1; col <= 5; col++) {
        const cell = sheet.getRow(rowNum).getCell(col);
        expect(cell.border?.left?.style).toBe("medium");
        expect(cell.border?.right?.style).toBe("medium");
        expect(cell.border?.top?.style).toBe("thin");
        expect(cell.border?.bottom?.style).toBe("thin");
      }
    }
  });
});
