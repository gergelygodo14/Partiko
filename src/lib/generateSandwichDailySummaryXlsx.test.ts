import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateSandwichDailySummaryXlsx } from "@/lib/generateSandwichDailySummaryXlsx";
import type { SandwichDailyItemTotal } from "@/lib/sandwichOrdersSummary";

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("generateSandwichDailySummaryXlsx", () => {
  it("has no header row - item data starts at row 1", async () => {
    const items: SandwichDailyItemTotal[] = [
      { itemId: "i1", itemName: "Hamburger", itemOrder: 4, quantity: 3 },
    ];
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-06", "HÉTFŐ", items);
    const workbook = await readBack(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe("hamburger"); // reference-sheet shorthand
    expect(sheet.getRow(1).getCell(2).value).toBe(3);
  });

  it("includes items with a zero quantity, not just items that were ordered", async () => {
    const items: SandwichDailyItemTotal[] = [
      { itemId: "i1", itemName: "Hamburger", itemOrder: 4, quantity: 0 },
      { itemId: "i2", itemName: "Sonkás bagel", itemOrder: 1, quantity: 5 },
    ];
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-06", "HÉTFŐ", items);
    const workbook = await readBack(buffer);
    const sheet = workbook.worksheets[0];

    // Sorted by catalog order: BAGEL (order 1) before hamburger (order 4).
    expect(sheet.getRow(1).getCell(1).value).toBe("BAGEL");
    expect(sheet.getRow(1).getCell(2).value).toBe(5);
    expect(sheet.getRow(2).getCell(1).value).toBe("hamburger");
    expect(sheet.getRow(2).getCell(2).value).toBe(0);
  });

  it("uses large bold italic Arial for item names and bold Comic Sans MS for quantities", async () => {
    const items: SandwichDailyItemTotal[] = [
      { itemId: "i1", itemName: "Hamburger", itemOrder: 4, quantity: 2 },
    ];
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-06", "HÉTFŐ", items);
    const workbook = await readBack(buffer);
    const sheet = workbook.worksheets[0];

    const nameFont = sheet.getRow(1).getCell(1).font;
    expect(nameFont).toMatchObject({ name: "Arial", bold: true, italic: true, size: 16 });
    const qtyFont = sheet.getRow(1).getCell(2).font;
    expect(qtyFont).toMatchObject({ name: "Comic Sans MS", bold: true, size: 11 });
  });

  it("falls back to the catalog name for an item with no reference-sheet shorthand mapping", async () => {
    const items: SandwichDailyItemTotal[] = [
      { itemId: "i1", itemName: "Teszt tétel", itemOrder: 1, quantity: 1 },
    ];
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-06", "HÉTFŐ", items);
    const workbook = await readBack(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe("Teszt tétel");
  });

  it("uses landscape A4 with fit-to-width", async () => {
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-06", "HÉTFŐ", []);
    const workbook = await readBack(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToWidth).toBe(1);
  });

  it("produces a valid empty sheet when the catalog list is empty", async () => {
    const buffer = await generateSandwichDailySummaryXlsx("2026-07-05", "VASÁRNAP", []);
    const workbook = await readBack(buffer);
    expect(workbook.worksheets[0].rowCount).toBe(0);
  });
});
