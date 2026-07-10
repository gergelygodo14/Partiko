import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { InvoiceStatus, Supplier } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { extractInvoiceLineItems, processInvoiceLineItems } from "@/lib/invoiceProcessing";

export const maxDuration = 60;

function isValidSupplier(value: unknown): value is Supplier {
  return value === Supplier.SAJTFUTAR || value === Supplier.BAROMFIUDVAR;
}

export const GET = withApiErrorHandling(async () => {
  const invoices = await prisma.invoice.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(invoices);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const formData = await request.formData();
  const supplier = formData.get("supplier");
  const photo = formData.get("photo");

  if (!isValidSupplier(supplier)) {
    return NextResponse.json({ error: "Érvénytelen beszállító" }, { status: 400 });
  }
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "Érvénytelen vagy hiányzó fotó" }, { status: 400 });
  }

  const blob = await put(`szamlak/${photo.name}`, photo, {
    access: "public",
    addRandomSuffix: true,
  });

  const invoice = await prisma.invoice.create({
    data: {
      supplier,
      photoUrl: blob.url,
      photoBlobPathname: blob.pathname,
      status: InvoiceStatus.PROCESSING,
    },
  });

  try {
    const extraction = await extractInvoiceLineItems(blob.url);
    const { summaryText } = await processInvoiceLineItems(invoice.id, supplier, extraction);
    const processed = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PROCESSED,
        processedAt: new Date(),
        rawExtraction: extraction,
        summaryText,
      },
    });
    return NextResponse.json(processed, { status: 201 });
  } catch (error) {
    console.error(error);
    const failed = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.FAILED,
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Ismeretlen hiba",
      },
    });
    return NextResponse.json(failed, { status: 201 });
  }
});
