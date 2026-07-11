import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parsePriceListBuffer } from "@/lib/priceListParsing";

async function buildSampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Munka1");

  ws.addRow(["Baromfiudvar 2002 Kft"]);
  ws.addRow(["Cím: 4002 Debrecen, Balmazújváros út 10"]);
  ws.addRow(["ÜP kódja: V025441"]);
  ws.addRow(["ÜP neve: GODÓ KFT."]);
  ws.addRow(["Érvényes: 2026.07.13-tól - visszavonásig"]);
  ws.addRow([]);
  ws.addRow(["Megnevezés", "Csommód", "Me", "ÁFA %", "3x", "Nettó Ár (Ft)", null]);
  ws.addRow(["01 - FRISS BAROMFI"]);
  ws.addRow(["FRISS CSIRKE MELLFILÉ TRANSAVIA", "Lédig", "KG", 5, "N", 1899, ""]);
  ws.addRow(["FRISS CSIRKE SZÁRNY", "Lédig", "KG", 5, "N", 679, ""]);
  ws.addRow(["08 - TÖLTELÉKÁRU"]);
  ws.addRow(["KEDVENC ÍZEK BACON SZELETELT 1 KG", "Vákum csomag", "DB", 27, "N", 2709, "*"]);
  ws.addRow([]);
  ws.addRow(["A fenti árak az ÁFA-t nem tartalmazzák!"]);
  ws.addRow(["Debrecen, 2026.07.10"]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("parsePriceListBuffer", () => {
  it("extracts the valid-from date from the header block", async () => {
    const buffer = await buildSampleWorkbook();
    const result = await parsePriceListBuffer(buffer);
    expect(result.validFrom).toEqual(new Date(2026, 6, 13));
  });

  it("skips category-header rows and extracts product rows", async () => {
    const buffer = await buildSampleWorkbook();
    const result = await parsePriceListBuffer(buffer);
    expect(result.items).toEqual([
      { name: "FRISS CSIRKE MELLFILÉ TRANSAVIA", unit: "kg", unitPrice: 1899 },
      { name: "FRISS CSIRKE SZÁRNY", unit: "kg", unitPrice: 679 },
      { name: "KEDVENC ÍZEK BACON SZELETELT 1 KG", unit: "db", unitPrice: 2709 },
    ]);
  });

  it("stops at the trailing blank row and ignores the footer", async () => {
    const buffer = await buildSampleWorkbook();
    const result = await parsePriceListBuffer(buffer);
    expect(result.items.some((i) => i.name.includes("ÁFA"))).toBe(false);
    expect(result.items).toHaveLength(3);
  });

  it("throws when the expected header row is missing", async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Munka1");
    ws.addRow(["Valami egészen más fájl"]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    await expect(parsePriceListBuffer(Buffer.from(arrayBuffer))).rejects.toThrow(/fejléc/);
  });
});
