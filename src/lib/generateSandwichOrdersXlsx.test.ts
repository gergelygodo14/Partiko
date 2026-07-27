import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateSandwichOrdersXlsx } from "@/lib/generateSandwichOrdersXlsx";
import type { SandwichDayCustomerOrder } from "@/lib/sandwichOrdersSummary";

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("generateSandwichOrdersXlsx", () => {
  it("names the sheet 'SZENDVICS <nap>' and uses the date as a fallback when no day name is given", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "", []);
    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("SZENDVICS 2026-07-06")).toBeDefined();
  });

  it("puts stores across the header row (not down the rows) and items down the first column", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [
          { itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 3 },
          { itemId: "molnarka", itemName: "Molnárka", itemOrder: 2, quantity: 1 },
        ],
        totalQuantity: 4,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 2 }],
        totalQuantity: 2,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ")!;

    const header = sheet.getRow(1);
    expect(header.getCell(1).value).toBe("HÉTFŐ");
    // Biggest orderer first, as given in `rows` (already sorted upstream).
    expect(header.getCell(2).value).toBe("Zöld Bolt");
    expect(header.getCell(3).value).toBe("Alma Büfé");

    // Items sorted by catalog order down the rows.
    expect(sheet.getRow(2).getCell(1).value).toBe("Hamburger");
    expect(sheet.getRow(3).getCell(1).value).toBe("Molnárka");
  });

  it("fills in quantities per store/item and blanks where a store didn't order that item", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 3 }],
        totalQuantity: 3,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "molnarka", itemName: "Molnárka", itemOrder: 2, quantity: 5 }],
        totalQuantity: 5,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ")!;

    // Row 2 = Hamburger: Zöld Bolt=3, Alma Büfé=blank.
    expect(sheet.getRow(2).getCell(2).value).toBe(3);
    expect(sheet.getRow(2).getCell(3).value).toBeFalsy();
    // Row 3 = Molnárka: Zöld Bolt=blank, Alma Büfé=5.
    expect(sheet.getRow(3).getCell(2).value).toBeFalsy();
    expect(sheet.getRow(3).getCell(3).value).toBe(5);
  });

  it("computes a per-item row total and a bold grand-total row at the bottom", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 3 }],
        totalQuantity: 3,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 2 }],
        totalQuantity: 2,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ")!;

    const totalsColIndex = sheet.getRow(1).values as unknown[];
    const totalCol = totalsColIndex.indexOf("Összesen");
    expect(sheet.getRow(2).getCell(totalCol).value).toBe(5); // 3 + 2

    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(1).value).toBe("Összesen");
    expect(totalsRow.getCell(2).value).toBe(3); // Zöld Bolt column total
    expect(totalsRow.getCell(3).value).toBe(2); // Alma Büfé column total
    expect(totalsRow.getCell(totalCol).value).toBe(5); // grand total
    expect(totalsRow.getCell(1).font?.bold).toBe(true);
    expect(totalsRow.getCell(2).font?.bold).toBe(true);
    expect(totalsRow.getCell(1).border?.top?.style).toBe("thick");
  });

  it("only lists items that actually appear that day, not the full catalog", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "hamburger", itemName: "Hamburger", itemOrder: 1, quantity: 1 }],
        totalQuantity: 1,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ")!;

    // Header + 1 item row + totals row = 3 rows total.
    expect(sheet.rowCount).toBe(3);
  });

  it("uses landscape A4 with fit-to-width (not fit-to-height)", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ")!;

    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.fitToHeight).toBe(0);
  });

  it("still produces a valid, empty sheet when nothing was ordered", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-05", "VASÁRNAP", []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS VASÁRNAP")!;
    expect(sheet.getRow(sheet.rowCount).getCell(1).value).toBe("Összesen");
  });
});
