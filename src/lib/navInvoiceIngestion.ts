import { prisma } from "@/lib/db";
import { InvoiceStatus, PriceSource, Supplier } from "@/generated/prisma/client";
import { queryInvoiceDigest, queryInvoiceData, type InboundInvoiceDigest } from "@/lib/nav";
import { processInvoiceLineItems, type ExtractedInvoice } from "@/lib/invoiceProcessing";
import { addDaysStr } from "@/lib/dates";

// Maps NAV's own supplier tax number to this app's Supplier enum - confirmed
// with the owner 2026-09-07 (see project_partiko_nav_integration memory: the
// 34-day digest surfaced 25 distinct real suppliers, most of them not
// ingredient suppliers at all). This is the allowlist that decides which
// invoices get the FULL price-tracking pipeline (product matching,
// PriceObservation, price-jump alerts) - every other NAV invoice still gets
// recorded (see "ledger-only" below, owner request 2026-09-08: "Összes
// számla" should list every incoming invoice, not just these two), just
// without price analysis, since that only makes sense for ingredient
// suppliers.
export const NAV_SUPPLIER_TAX_NUMBER: Record<Supplier, string> = {
  SAJTFUTAR: "13833185", // SAJT-EXPRESSZ Kft.
  BAROMFIUDVAR: "12830093", // Baromfiudvar 2002 Kft.
};

const SUPPLIER_BY_TAX_NUMBER = new Map<string, Supplier>(
  (Object.entries(NAV_SUPPLIER_TAX_NUMBER) as [Supplier, string][]).map(([supplier, taxNumber]) => [
    taxNumber,
    supplier,
  ])
);

/** NAV's line items arrive already structured (no OCR/vision step), so they
 *  map directly into the same ExtractedInvoice shape the photo pipeline
 *  produces - no AI call needed. There's no AI-derived short, colloquial
 *  name here (unlike the photo path's `shortName`, which the vision model
 *  invents specifically for that purpose) - the full lineDescription doubles
 *  as both `name` and `shortName`, same as the email price-list path (which
 *  never had a shortName concept either and works fine without one). Lines
 *  missing a description, quantity, or price are dropped rather than passed
 *  through with nulls - can't build a real PriceObservation from those. */
export function toExtractedInvoice(data: {
  issueDate: string | null;
  lines: { description: string | null; quantity: number | null; unit: string | null; unitPriceHUF: number | null }[];
}): ExtractedInvoice {
  return {
    invoiceDate: data.issueDate,
    lineItems: data.lines
      .filter(
        (l): l is typeof l & { description: string; quantity: number; unitPriceHUF: number } =>
          l.description !== null && l.quantity !== null && l.unitPriceHUF !== null
      )
      .map((l) => ({
        name: l.description,
        shortName: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPriceHUF,
      })),
  };
}

export type NavInvoiceImportOutcome =
  | { status: "imported"; supplier: Supplier; invoiceNumber: string; lineCount: number }
  | { status: "ledger_only"; supplier: Supplier | null; supplierName: string | null; invoiceNumber: string }
  | { status: "already_imported"; invoiceNumber: string }
  | { status: "no_usable_lines"; supplier: Supplier; invoiceNumber: string }
  | { status: "error"; supplierName: string | null; invoiceNumber: string; error: string };

// NAV caps a single queryInvoiceDigest call's issue-date range at 35 days
// (BAD_QUERY_PARAM_RANGE_EXCEEDED past that, confirmed live 2026-09-07) - a
// wide range (e.g. a historical backfill) is split into chunks here so no
// caller has to worry about the cap itself.
const MAX_QUERY_RANGE_DAYS = 35;

/** Splits [dateFrom, dateTo] into consecutive <=35-day windows, inclusive on
 *  both ends. Exported for direct unit testing. */
export function splitDateRangeIntoChunks(dateFrom: string, dateTo: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let chunkStart = dateFrom;
  while (chunkStart <= dateTo) {
    const naturalEnd = addDaysStr(chunkStart, MAX_QUERY_RANGE_DAYS - 1);
    const chunkEnd = naturalEnd < dateTo ? naturalEnd : dateTo;
    chunks.push({ from: chunkStart, to: chunkEnd });
    chunkStart = addDaysStr(chunkEnd, 1);
  }
  return chunks;
}

/** Sweeps queryInvoiceDigest for the given issue-date range (chunked into
 *  <=35-day windows, see above), skips invoices already imported (dedup key
 *  [supplierTaxNumber, navInvoiceNumber] - see the Invoice model), and for
 *  each new one either:
 *   - runs the tracked-supplier pipeline (product matching, price-jump
 *     hold-back + Telegram alert, PriceObservation) - same as the
 *     photo-upload route used to, or
 *   - records a lightweight "ledger-only" row (date + net/vat amounts +
 *     supplier name, no line-item/price analysis) - either because the
 *     supplier is outside the 2-supplier tracked scope, or because the
 *     caller passed `ledgerOnly: true` (see below).
 *
 *  `ledgerOnly: true` forces EVERY invoice (even the 2 tracked suppliers')
 *  through the lightweight path. This exists for historical backfills: the
 *  photo-upload pipeline already captured Sajtfutár/Baromfiudvar prices for
 *  invoices before the NAV integration went live (2026-09-07), so re-running
 *  those same invoices through product matching would create duplicate
 *  PriceObservation rows and could fire spurious price-jump alerts against
 *  data that's already correct. A ledger-only backfill still fully captures
 *  everyone's spend for "Összes számla"/Kiadások (which only ever reads
 *  netAmountHUF/vatAmountHUF, never priceObservations), with zero risk of
 *  duplicating anything the photo pipeline already recorded. */
export async function importNavInvoicesForRange(
  dateFrom: string,
  dateTo: string,
  options?: { ledgerOnly?: boolean }
): Promise<NavInvoiceImportOutcome[]> {
  const outcomes: NavInvoiceImportOutcome[] = [];
  for (const chunk of splitDateRangeIntoChunks(dateFrom, dateTo)) {
    outcomes.push(...(await importNavInvoicesForChunk(chunk.from, chunk.to, options?.ledgerOnly ?? false)));
  }
  return outcomes;
}

async function importNavInvoicesForChunk(
  dateFrom: string,
  dateTo: string,
  ledgerOnly: boolean
): Promise<NavInvoiceImportOutcome[]> {
  const digestEntries: InboundInvoiceDigest[] = [];
  let page = 1;
  for (;;) {
    const { invoices, availablePage } = await queryInvoiceDigest({ dateFrom, dateTo, page });
    digestEntries.push(...invoices);
    if (invoices.length === 0 || page >= availablePage) break;
    page++;
  }

  // Oldest-first: the price-jump comparison in processInvoiceLineItems looks
  // at whatever's currently the latest PriceObservation for a product - NAV's
  // own digest order isn't guaranteed chronological, and importing out of
  // order could compare an older invoice's price against an already-imported
  // NEWER one, producing a wrong (or missed) price-jump flag.
  digestEntries.sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  const outcomes: NavInvoiceImportOutcome[] = [];

  for (const entry of digestEntries) {
    const existing = await prisma.invoice.findFirst({
      where: { navInvoiceNumber: entry.invoiceNumber, supplierTaxNumber: entry.supplierTaxNumber },
      select: { id: true },
    });
    if (existing) {
      outcomes.push({ status: "already_imported", invoiceNumber: entry.invoiceNumber });
      continue;
    }

    const supplier = entry.supplierTaxNumber ? SUPPLIER_BY_TAX_NUMBER.get(entry.supplierTaxNumber) : undefined;

    if (!supplier || ledgerOnly) {
      await prisma.invoice.create({
        data: {
          supplier: supplier ?? null,
          supplierTaxNumber: entry.supplierTaxNumber,
          supplierName: entry.supplierName,
          navInvoiceNumber: entry.invoiceNumber,
          status: InvoiceStatus.PROCESSED,
          processedAt: new Date(),
          issueDate: new Date(entry.issueDate),
          netAmountHUF: entry.invoiceNetAmountHUF,
          vatAmountHUF: entry.invoiceVatAmountHUF,
        },
      });
      outcomes.push({
        status: "ledger_only",
        supplier: supplier ?? null,
        supplierName: entry.supplierName,
        invoiceNumber: entry.invoiceNumber,
      });
      continue;
    }

    try {
      const data = await queryInvoiceData(entry.invoiceNumber, "INBOUND");
      const extraction = toExtractedInvoice(data);
      if (extraction.lineItems.length === 0) {
        outcomes.push({ status: "no_usable_lines", supplier, invoiceNumber: entry.invoiceNumber });
        continue;
      }

      const invoiceRow = await prisma.invoice.create({
        data: {
          supplier,
          supplierTaxNumber: entry.supplierTaxNumber,
          supplierName: entry.supplierName,
          navInvoiceNumber: entry.invoiceNumber,
          status: InvoiceStatus.PROCESSING,
          issueDate: extraction.invoiceDate ? new Date(extraction.invoiceDate) : null,
          netAmountHUF: entry.invoiceNetAmountHUF,
          vatAmountHUF: entry.invoiceVatAmountHUF,
        },
      });

      const { summaryText, highlightText, pendingLineItems } = await processInvoiceLineItems(
        invoiceRow.id,
        supplier,
        extraction,
        PriceSource.NAV
      );

      await prisma.invoice.update({
        where: { id: invoiceRow.id },
        data: {
          status: InvoiceStatus.PROCESSED,
          processedAt: new Date(),
          rawExtraction: extraction,
          summaryText,
          highlightText,
          pendingLineItems,
        },
      });

      outcomes.push({
        status: "imported",
        supplier,
        invoiceNumber: entry.invoiceNumber,
        lineCount: extraction.lineItems.length,
      });
    } catch (e) {
      outcomes.push({
        status: "error",
        supplierName: entry.supplierName,
        invoiceNumber: entry.invoiceNumber,
        error: e instanceof Error ? e.message : "Ismeretlen hiba",
      });
    }
  }

  return outcomes;
}
