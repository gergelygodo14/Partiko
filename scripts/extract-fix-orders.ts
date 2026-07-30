// Reads the kitchen's hand-maintained reference workbook
// (partiko-szendvics/reference/rendelések.xlsx) and extracts, per weekday,
// what each store typically orders - the seed data for SandwichFixOrder.
//
// Read-only: touches no database. Writes a reviewable JSON that
// import-fix-orders.ts then loads, so the messy name/label decisions are
// visible in a diff before anything reaches the live data.
//
//   npx tsx scripts/extract-fix-orders.ts
//
// Sheet layout (verified identical on all 13 weekday tabs):
//   A4:A29  the 26 item labels, in EXCEL_LABEL_BY_ITEM_NAME's own order
//   row 1   a numeric store code - IGNORED, see below
//   row 2+3 the store name, split across two cells
//   D..     one column per store, then a trailing per-item total column
//   row 30  the sheet's own =SUM(D4:D29) per column
//
// The row-1 store code is deliberately unused: on "KEDD (2)" the code 18 sits
// above Székelysor while ÚJ KL - whose code is 18 on four other sheets - sits
// three columns to its left with no code at all. The codes drifted; the names
// did not.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { EXCEL_LABEL_BY_ITEM_NAME } from "../src/lib/sandwichItemLabels";
import {
  EXPECTED_ITEM_LABELS,
  ITEM_NAME_BY_EXCEL_LABEL,
  NEW_STORE_NAMES,
  RAW_STORE_ALIASES,
  SHEETS_BY_WEEKDAY,
} from "../src/lib/sandwichFixOrderSource";

const WORKBOOK_PATH = path.join(
  __dirname,
  "..",
  "..",
  "partiko-szendvics",
  "reference",
  "rendelések.xlsx"
);
const OUTPUT_PATH = path.join(__dirname, "fix-orders.extracted.json");

const FIRST_ITEM_ROW = 4;
const LAST_ITEM_ROW = 29;
const TOTALS_ROW = 30;
const FIRST_STORE_COLUMN = 4; // D


type ExtractedLine = { excelLabel: string; itemName: string; quantity: number };

type ExtractedStore = {
  rawName: string;
  storeName: string;
  sheet: string;
  column: string;
  sheetCode: string;
  sheetTotal: number | null;
  computedTotal: number;
  storeOrder: number;
  lines: ExtractedLine[];
};

type ExtractedWeekday = { weekday: number; sheets: string[]; stores: ExtractedStore[] };

const warnings: string[] = [];

function cellValue(sheet: ExcelJS.Worksheet, row: number, col: number): unknown {
  const cell = sheet.getRow(row).getCell(col).value;
  if (cell !== null && typeof cell === "object") {
    if ("richText" in cell) return cell.richText.map((part) => part.text).join("");
    // Formula cells: ExcelJS only exposes a cached `result` when Excel stored
    // one. Shared-formula cells (`{sharedFormula}`) never carry their own, so
    // "no result" is normal here and must not be read as zero.
    if ("result" in cell) return cell.result;
    return null;
  }
  return cell;
}

function cellText(sheet: ExcelJS.Worksheet, row: number, col: number): string {
  const value = cellValue(sheet, row, col);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cellNumber(sheet: ExcelJS.Worksheet, row: number, col: number): number | null {
  const value = cellValue(sheet, row, col);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function columnLetter(col: number): string {
  let result = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function assertItemLabels(sheet: ExcelJS.Worksheet): string[] {
  const labels: string[] = [];
  for (let row = FIRST_ITEM_ROW; row <= LAST_ITEM_ROW; row++) {
    labels.push(cellText(sheet, row, 1));
  }
  const mismatches = labels
    .map((label, i) => ({ i, label, expected: EXPECTED_ITEM_LABELS[i] }))
    .filter((entry) => entry.label !== entry.expected);
  if (mismatches.length > 0) {
    throw new Error(
      `[${sheet.name}] A4:A29 tétel-címkéi nem egyeznek az EXCEL_LABEL_BY_ITEM_NAME sorrendjével:\n` +
        mismatches
          .map((m) => `  A${FIRST_ITEM_ROW + m.i}: "${m.label}" (várt: "${m.expected}")`)
          .join("\n")
    );
  }
  return labels;
}

function extractSheet(sheet: ExcelJS.Worksheet, labels: string[]): ExtractedStore[] {
  const stores: ExtractedStore[] = [];

  for (let col = FIRST_STORE_COLUMN; col <= sheet.columnCount; col++) {
    const rawName = `${cellText(sheet, 2, col)} ${cellText(sheet, 3, col)}`
      .replace(/\s+/g, " ")
      .trim();
    // Unnamed columns are the blank spacers and the trailing per-item total
    // column - both must not become stores.
    if (!rawName) continue;

    const storeName = RAW_STORE_ALIASES[rawName];
    if (!storeName) {
      throw new Error(
        `[${sheet.name}] ${columnLetter(col)}2:${columnLetter(col)}3 ismeretlen boltnév: "${rawName}".\n` +
          `Vedd fel a RAW_STORE_ALIASES táblába - a script szándékosan nem talál ki boltot.`
      );
    }

    const lines: ExtractedLine[] = [];
    let computedTotal = 0;
    for (let row = FIRST_ITEM_ROW; row <= LAST_ITEM_ROW; row++) {
      const quantity = cellNumber(sheet, row, col);
      if (quantity === null || quantity === 0) continue;
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error(
          `[${sheet.name}] ${columnLetter(col)}${row} érvénytelen mennyiség: ${quantity}`
        );
      }
      const excelLabel = labels[row - FIRST_ITEM_ROW];
      const itemName = ITEM_NAME_BY_EXCEL_LABEL.get(excelLabel);
      if (!itemName) throw new Error(`[${sheet.name}] ismeretlen tétel-címke: "${excelLabel}"`);
      lines.push({ excelLabel, itemName, quantity });
      computedTotal += quantity;
    }

    const sheetTotal = cellNumber(sheet, TOTALS_ROW, col);
    // Verification oracle #1: the sheet's own SUM. Only available where Excel
    // cached a result (shared-formula cells carry none), so a null is skipped
    // rather than treated as a mismatch.
    if (sheetTotal !== null && sheetTotal !== computedTotal) {
      throw new Error(
        `[${sheet.name}] ${columnLetter(col)} ("${rawName}") összeg-eltérés: ` +
          `a lap SUM-ja ${sheetTotal}, a kiolvasott tételek összege ${computedTotal}`
      );
    }
    if (sheetTotal === null && computedTotal > 0) {
      warnings.push(
        `[${sheet.name}] ${columnLetter(col)} ("${rawName}"): nincs gyorsítótárazott SUM a 30. sorban, ` +
          `az összeg (${computedTotal}) nem ellenőrizhető a lap ellen`
      );
    }

    stores.push({
      rawName,
      storeName,
      sheet: sheet.name,
      column: columnLetter(col),
      sheetCode: cellText(sheet, 1, col),
      sheetTotal,
      computedTotal,
      storeOrder: 0, // assigned once per weekday below
      lines,
    });
  }

  return stores;
}

async function main() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Nem található a munkafüzet: ${WORKBOOK_PATH}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const weekdays: ExtractedWeekday[] = [];

  for (const [weekdayStr, sheetNames] of Object.entries(SHEETS_BY_WEEKDAY)) {
    const weekday = Number(weekdayStr);
    const stores: ExtractedStore[] = [];

    for (const sheetName of sheetNames) {
      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) throw new Error(`Hiányzó munkalap: "${sheetName}"`);
      const labels = assertItemLabels(sheet);
      stores.push(...extractSheet(sheet, labels));
    }

    // Two tabs of the same weekday can list the same store (the "(2)" sheets
    // are a manual page-break, not a separate roster) - merge rather than
    // letting the later column silently win.
    const merged = new Map<string, ExtractedStore>();
    for (const store of stores) {
      const existing = merged.get(store.storeName);
      if (!existing) {
        merged.set(store.storeName, { ...store, storeOrder: merged.size + 1 });
        continue;
      }
      warnings.push(
        `weekday=${weekday}: "${store.storeName}" kétszer szerepel ` +
          `([${existing.sheet}]!${existing.column} és [${store.sheet}]!${store.column}) - összevonva`
      );
      for (const line of store.lines) {
        const target = existing.lines.find((l) => l.itemName === line.itemName);
        if (target) target.quantity += line.quantity;
        else existing.lines.push(line);
      }
      existing.computedTotal += store.computedTotal;
      existing.sheetTotal =
        existing.sheetTotal === null || store.sheetTotal === null
          ? null
          : existing.sheetTotal + store.sheetTotal;
    }

    weekdays.push({ weekday, sheets: sheetNames, stores: [...merged.values()] });
  }

  // Verification oracle #2: item-label bijection.
  const labelValues = Object.values(EXCEL_LABEL_BY_ITEM_NAME);
  if (new Set(labelValues).size !== labelValues.length) {
    throw new Error("EXCEL_LABEL_BY_ITEM_NAME nem bijekció - két tétel ugyanarra a címkére mutat");
  }

  const allStoreNames = [...new Set(weekdays.flatMap((w) => w.stores.map((s) => s.storeName)))];

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFile: "partiko-szendvics/reference/rendelések.xlsx",
    newStores: NEW_STORE_NAMES,
    warnings,
    weekdays,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`\n✓ Kiírva: ${path.relative(process.cwd(), OUTPUT_PATH)}\n`);
  for (const weekday of weekdays) {
    const total = weekday.stores.reduce((sum, s) => sum + s.computedTotal, 0);
    const empty = weekday.stores.filter((s) => s.lines.length === 0).length;
    console.log(
      `  weekday=${weekday.weekday}: ${String(weekday.stores.length).padStart(2)} bolt, ` +
        `${String(total).padStart(4)} db, ${empty} üres oszlop`
    );
  }
  console.log(`\n  ${allStoreNames.length} egyedi bolt összesen`);
  console.log(`  Létrehozandó új bolt: ${NEW_STORE_NAMES.join(", ")}`);

  if (warnings.length > 0) {
    console.log(`\n  ${warnings.length} figyelmeztetés:`);
    for (const warning of warnings.slice(0, 12)) console.log(`    - ${warning}`);
    if (warnings.length > 12) console.log(`    ... és még ${warnings.length - 12}`);
  }
  console.log();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
