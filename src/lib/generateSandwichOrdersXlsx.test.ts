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
  it("names the first sheet 'SZENDVICS <nap> 1' and uses the date as a fallback when no day name is given", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "", []);
    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("SZENDVICS 2026-07-06 1")).toBeDefined();
  });

  it("puts stores across the header row (not down the rows) and items down the first column", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [
          { itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 3 },
          { itemId: "teszt2", itemName: "Teszt Molnárka", itemOrder: 2, quantity: 1 },
        ],
        totalQuantity: 4,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 2 }],
        totalQuantity: 2,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    const header = sheet.getRow(1);
    expect(header.getCell(1).value).toBe("HÉTFŐ");
    // Biggest orderer first, as given in `rows` (already sorted upstream).
    expect(header.getCell(2).value).toBe("Zöld Bolt");
    expect(header.getCell(3).value).toBe("Alma Büfé");

    // Items sorted by catalog order down the rows (names not in the
    // reference-label map pass through unchanged).
    expect(sheet.getRow(2).getCell(1).value).toBe("Teszt Szendvics");
    expect(sheet.getRow(3).getCell(1).value).toBe("Teszt Molnárka");
  });

  it("fills in quantities per store/item and blanks where a store didn't order that item", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 3 }],
        totalQuantity: 3,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "teszt2", itemName: "Teszt Molnárka", itemOrder: 2, quantity: 5 }],
        totalQuantity: 5,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    // Row 2 = Teszt Szendvics: Zöld Bolt=3, Alma Büfé=blank.
    expect(sheet.getRow(2).getCell(2).value).toBe(3);
    expect(sheet.getRow(2).getCell(3).value).toBeFalsy();
    // Row 3 = Teszt Molnárka: Zöld Bolt=blank, Alma Büfé=5.
    expect(sheet.getRow(3).getCell(2).value).toBeFalsy();
    expect(sheet.getRow(3).getCell(3).value).toBe(5);
  });

  it("computes a per-item row total and a bold grand-total row at the bottom", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 3 }],
        totalQuantity: 3,
      },
      {
        customerId: "c2",
        storeName: "Alma Büfé",
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 2 }],
        totalQuantity: 2,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

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
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 1 }],
        totalQuantity: 1,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    // Header + 1 item row + totals row = 3 rows total.
    expect(sheet.rowCount).toBe(3);
  });

  it("uses landscape A4 with fit-to-width (not fit-to-height)", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.fitToHeight).toBe(0);
  });

  it("still produces a valid, empty sheet when nothing was ordered", async () => {
    const buffer = await generateSandwichOrdersXlsx("2026-07-05", "VASÁRNAP", []);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS VASÁRNAP 1")!;
    expect(sheet.getRow(sheet.rowCount).getCell(1).value).toBe("Összesen");
  });

  it("splits stores across two sheets once a day is wide enough (more than 8 stores)", async () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const rows: SandwichDayCustomerOrder[] = names.map((name, i) => ({
      customerId: `c${i}`,
      storeName: name,
      lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 1 }],
      totalQuantity: 1,
    }));
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);

    const sheet1 = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;
    const sheet2 = workbook.getWorksheet("SZENDVICS HÉTFŐ 2")!;
    expect(sheet1).toBeDefined();
    expect(sheet2).toBeDefined();

    // 9 stores chunked into a full sheet of 8, then 1 on the next.
    expect(sheet1.getRow(1).getCell(2).value).toBe("A");
    expect(sheet1.getRow(1).getCell(9).value).toBe("H");
    expect(sheet2.getRow(1).getCell(2).value).toBe("I");
  });

  it("adds a third sheet when even the second sheet would overflow", async () => {
    const names = Array.from({ length: 20 }, (_, i) => `Store${i + 1}`);
    const rows: SandwichDayCustomerOrder[] = names.map((name, i) => ({
      customerId: `c${i}`,
      storeName: name,
      lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 1 }],
      totalQuantity: 1,
    }));
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);

    // 20 stores -> 8 + 8 + 4 across three sheets.
    expect(workbook.getWorksheet("SZENDVICS HÉTFŐ 1")).toBeDefined();
    expect(workbook.getWorksheet("SZENDVICS HÉTFŐ 2")).toBeDefined();
    const sheet3 = workbook.getWorksheet("SZENDVICS HÉTFŐ 3")!;
    expect(sheet3).toBeDefined();
    expect(sheet3.getRow(1).getCell(2).value).toBe("Store17");
    expect(sheet3.getRow(1).getCell(5).value).toBe("Store20");
    expect(workbook.getWorksheet("SZENDVICS HÉTFŐ 4")).toBeUndefined();
  });

  it("keeps everything on one sheet for a normal-size day (8 stores or fewer)", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [{ itemId: "teszt1", itemName: "Teszt Szendvics", itemOrder: 1, quantity: 1 }],
        totalQuantity: 1,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    expect(workbook.getWorksheet("SZENDVICS HÉTFŐ 1")).toBeDefined();
    expect(workbook.getWorksheet("SZENDVICS HÉTFŐ 2")).toBeUndefined();
  });

  it("prints the reference sheet's own item labels (exact case), not the full catalog name", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [
          { itemId: "i1", itemName: "Hamburger", itemOrder: 4, quantity: 1 },
          { itemId: "i2", itemName: "Sonkás bagel", itemOrder: 1, quantity: 1 },
          { itemId: "i3", itemName: "Rántott húsos papucs", itemOrder: 16, quantity: 1 },
        ],
        totalQuantity: 3,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    expect(sheet.getRow(2).getCell(1).value).toBe("BAGEL");
    expect(sheet.getRow(3).getCell(1).value).toBe("hamburger");
    expect(sheet.getRow(4).getCell(1).value).toBe("RHZS PAPUCS");
  });

  it("draws a thick bottom border under a group-boundary item (order 4) but not a non-boundary one", async () => {
    const rows: SandwichDayCustomerOrder[] = [
      {
        customerId: "c1",
        storeName: "Zöld Bolt",
        lines: [
          { itemId: "i1", itemName: "Hamburger", itemOrder: 4, quantity: 1 },
          { itemId: "i2", itemName: "Molnárka (kicsi) kolbászos", itemOrder: 5, quantity: 1 },
        ],
        totalQuantity: 2,
      },
    ];
    const buffer = await generateSandwichOrdersXlsx("2026-07-06", "HÉTFŐ", rows);
    const workbook = await readBack(buffer);
    const sheet = workbook.getWorksheet("SZENDVICS HÉTFŐ 1")!;

    // Row 2 = Hamburger (order 4, a group boundary) -> thick bottom rule.
    expect(sheet.getRow(2).getCell(1).border?.bottom?.style).toBe("thick");
    // Row 3 = molnárka,kolb (order 5, not a boundary) -> plain thin rule.
    expect(sheet.getRow(3).getCell(1).border?.bottom?.style).toBe("thin");
  });
});
