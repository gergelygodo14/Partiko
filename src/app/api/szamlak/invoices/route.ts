import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

// POST (manual photo upload) was removed 2026-09-08 - invoices now arrive
// automatically via the NAV integration (src/lib/navInvoiceIngestion.ts),
// and the owner no longer photographs paper invoices. GET stays: it serves
// the price-tracking pipeline's own processing log ("Feldolgozási napló")
// to the /szamlak page - the old photo-uploaded history plus NAV rows from
// the 2 tracked suppliers, i.e. rows that actually went through
// processInvoiceLineItems (always ends with summaryText on success or
// errorMessage on failure). A "ledger-only" row (an untracked supplier, or a
// backfill run with ledgerOnly - see navInvoiceIngestion.ts) never sets
// either, since it skips line-item/price analysis entirely, and belongs only
// in the "Összes számla" ledger (GET /api/szamlak/nav-invoices), not here.
export const GET = withApiErrorHandling(async () => {
  const invoices = await prisma.invoice.findMany({
    where: { OR: [{ summaryText: { not: null } }, { errorMessage: { not: null } }] },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(invoices);
});
