import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

// The full NAV-invoice ledger for the "Összes számla" section on /szamlak
// (owner request, 2026-09-08) - scoped to NAV-sourced rows only
// (navInvoiceNumber not null), since those are the only ones with
// issueDate/netAmountHUF/vatAmountHUF populated (see navInvoiceIngestion.ts).
// The old photo-uploaded rows stay in the separate "Feldolgozási napló" list
// (GET /api/szamlak/invoices), unaffected.
export const GET = withApiErrorHandling(async () => {
  const invoices = await prisma.invoice.findMany({
    where: { navInvoiceNumber: { not: null } },
    orderBy: [{ issueDate: "desc" }, { uploadedAt: "desc" }],
    select: {
      id: true,
      supplier: true,
      supplierName: true,
      navInvoiceNumber: true,
      issueDate: true,
      uploadedAt: true,
      netAmountHUF: true,
      vatAmountHUF: true,
      status: true,
    },
  });
  // issueDate should always be set for a real NAV row (NAV mandates it on
  // every invoice) - uploadedAt (import time) is only a fallback so the
  // ledger/grouping code below never has to special-case a null date.
  return NextResponse.json(
    invoices.map(({ uploadedAt, issueDate, ...rest }) => ({
      ...rest,
      issueDate: (issueDate ?? uploadedAt).toISOString().slice(0, 10),
    }))
  );
});
