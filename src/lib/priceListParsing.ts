import ExcelJS from "exceljs";

export type ParsedPriceListItem = {
  name: string;
  unit: string | null;
  unitPrice: number;
};

export type ParsedPriceList = {
  validFrom: Date | null;
  items: ParsedPriceListItem[];
};

const NAME_HEADER = "megnevezés";
const UNIT_HEADER = "me";
const PRICE_HEADER_SUBSTRING = "nettó ár";
const MAX_HEADER_SEARCH_ROWS = 30;
const VALID_FROM_RE = /érvényes:\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/i;

function cellText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown): string {
  return cellText(value).toLowerCase();
}

type ColumnRoles = { nameCol: number; unitCol: number; priceCol: number };

function findHeaderRow(worksheet: ExcelJS.Worksheet): { rowNumber: number; roles: ColumnRoles } | null {
  const searchLimit = Math.min(worksheet.rowCount, MAX_HEADER_SEARCH_ROWS);
  for (let r = 1; r <= searchLimit; r++) {
    const row = worksheet.getRow(r);
    let nameCol = -1;
    let unitCol = -1;
    let priceCol = -1;
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const header = normalizeHeader(row.getCell(c).value);
      if (header === NAME_HEADER) nameCol = c;
      else if (header === UNIT_HEADER) unitCol = c;
      else if (header.includes(PRICE_HEADER_SUBSTRING)) priceCol = c;
    }
    if (nameCol > 0 && unitCol > 0 && priceCol > 0) {
      return { rowNumber: r, roles: { nameCol, unitCol, priceCol } };
    }
  }
  return null;
}

function findValidFromDate(worksheet: ExcelJS.Worksheet, beforeRow: number): Date | null {
  for (let r = 1; r < beforeRow; r++) {
    const text = cellText(worksheet.getRow(r).getCell(1).value);
    const match = VALID_FROM_RE.exec(text);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  return null;
}

export async function parsePriceListBuffer(buffer: Buffer): Promise<ParsedPriceList> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Az árlista fájl nem tartalmaz munkalapot");
  }

  const header = findHeaderRow(worksheet);
  if (!header) {
    throw new Error("Nem található a várt fejléc (Megnevezés / Me / Nettó Ár) az árlista fájlban");
  }

  const validFrom = findValidFromDate(worksheet, header.rowNumber);
  const { nameCol, unitCol, priceCol } = header.roles;

  const items: ParsedPriceListItem[] = [];
  for (let r = header.rowNumber + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const name = cellText(row.getCell(nameCol).value);
    if (!name) break;

    const unitRaw = cellText(row.getCell(unitCol).value);
    const priceValue = row.getCell(priceCol).value;
    const priceNumber = typeof priceValue === "number" ? priceValue : Number(priceValue);

    const isCategoryHeaderRow = !unitRaw && (priceValue === null || priceValue === undefined);
    if (isCategoryHeaderRow) continue;

    if (!Number.isFinite(priceNumber)) continue;

    items.push({
      name,
      unit: unitRaw ? unitRaw.toLowerCase() : null,
      unitPrice: Math.round(priceNumber),
    });
  }

  return { validFrom, items };
}
