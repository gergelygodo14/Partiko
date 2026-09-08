import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

// POST (manual photo upload) was removed 2026-09-08 - invoices now arrive
// automatically via the NAV integration (src/lib/navInvoiceIngestion.ts),
// and the owner no longer photographs paper invoices. GET stays: it still
// serves every Invoice row (NAV-sourced and the old photo-uploaded history)
// to the /szamlak page.
export const GET = withApiErrorHandling(async () => {
  const invoices = await prisma.invoice.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(invoices);
});
