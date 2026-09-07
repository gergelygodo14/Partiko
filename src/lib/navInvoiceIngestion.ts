import { prisma } from "@/lib/db";
import { InvoiceStatus, PriceSource, Supplier } from "@/generated/prisma/client";
import { queryInvoiceDigest, queryInvoiceData } from "@/lib/nav";
import { processInvoiceLineItems, type ExtractedInvoice } from "@/lib/invoiceProcessing";

// Maps NAV's own supplier tax number to this app's Supplier enum - confirmed
// with the owner 2026-09-07 (see project_partiko_nav_integration memory: the
// 34-day digest surfaced 25 distinct real suppliers, most of them not
// ingredient suppliers at all - this mapping is the deliberate, narrow
// allowlist that keeps the NAV import scoped to exactly the same two
// suppliers the app already tracks, not "whatever NAV happens to report".
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
  | { status: "already_imported"; supplier: Supplier; invoiceNumber: string }
  | { status: "no_usable_lines"; supplier: Supplier; invoiceNumber: string }
  | { status: "error"; supplier: Supplier; invoiceNumber: string; error: string };

/** Sweeps queryInvoiceDigest for the given issue-date range (NAV caps a
 *  single query at 35 days), keeps only invoices from the two known
 *  suppliers, skips ones already imported (unique on [supplier,
 *  navInvoiceNumber] - see the Invoice model), and runs the rest through the
 *  exact same processInvoiceLineItems pipeline the photo-upload route uses
 *  (product matching, >=20% price-jump hold-back + Telegram alert). */
export async function importNavInvoicesForRange(
  dateFrom: string,
  dateTo: string
): Promise<NavInvoiceImportOutcome[]> {
  const candidates: { supplier: Supplier; invoiceNumber: string }[] = [];

  let page = 1;
  for (;;) {
    const { invoices, availablePage } = await queryInvoiceDigest({ dateFrom, dateTo, page });
    for (const inv of invoices) {
      const supplier = inv.supplierTaxNumber ? SUPPLIER_BY_TAX_NUMBER.get(inv.supplierTaxNumber) : undefined;
      if (supplier) candidates.push({ supplier, invoiceNumber: inv.invoiceNumber });
    }
    if (invoices.length === 0 || page >= availablePage) break;
    page++;
  }

  const outcomes: NavInvoiceImportOutcome[] = [];

  for (const { supplier, invoiceNumber } of candidates) {
    const existing = await prisma.invoice.findFirst({
      where: { supplier, navInvoiceNumber: invoiceNumber },
      select: { id: true },
    });
    if (existing) {
      outcomes.push({ status: "already_imported", supplier, invoiceNumber });
      continue;
    }

    try {
      const data = await queryInvoiceData(invoiceNumber, "INBOUND");
      const extraction = toExtractedInvoice(data);
      if (extraction.lineItems.length === 0) {
        outcomes.push({ status: "no_usable_lines", supplier, invoiceNumber });
        continue;
      }

      const invoiceRow = await prisma.invoice.create({
        data: { supplier, navInvoiceNumber: invoiceNumber, status: InvoiceStatus.PROCESSING },
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

      outcomes.push({ status: "imported", supplier, invoiceNumber, lineCount: extraction.lineItems.length });
    } catch (e) {
      outcomes.push({
        status: "error",
        supplier,
        invoiceNumber,
        error: e instanceof Error ? e.message : "Ismeretlen hiba",
      });
    }
  }

  return outcomes;
}
