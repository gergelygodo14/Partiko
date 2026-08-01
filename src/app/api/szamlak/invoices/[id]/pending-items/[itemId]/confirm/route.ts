import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PriceSource } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";
import type { PendingPriceItem } from "@/lib/invoiceProcessing";

// Confirms a held-back large price jump, optionally with a corrected price
// (the owner may have caught a misread while reviewing) - only then does it
// become a real PriceObservation and count in the price comparison.
export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/szamlak/invoices/[id]/pending-items/[itemId]/confirm">
) => {
  const { id, itemId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const overrideUnitPrice = body?.unitPrice;

  if (
    overrideUnitPrice !== undefined &&
    (typeof overrideUnitPrice !== "number" || !Number.isFinite(overrideUnitPrice))
  ) {
    return NextResponse.json({ error: "Érvénytelen unitPrice" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "Nem található" }, { status: 404 });
  }

  const pending = (invoice.pendingLineItems as unknown as PendingPriceItem[] | null) ?? [];
  const item = pending.find((p) => p.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Nem található" }, { status: 404 });
  }

  const unitPrice = overrideUnitPrice !== undefined ? Math.round(overrideUnitPrice) : item.newPrice;
  const remaining = pending.filter((p) => p.id !== itemId);

  const [, updatedInvoice] = await prisma.$transaction([
    prisma.priceObservation.create({
      data: {
        productId: item.productId,
        supplier: invoice.supplier,
        unitPrice,
        unit: item.unit ?? undefined,
        observedDate: new Date(item.observedDate),
        source: PriceSource.INVOICE_PHOTO,
        rawText: item.rawText,
        invoiceId: invoice.id,
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { pendingLineItems: remaining },
    }),
  ]);

  return NextResponse.json(updatedInvoice);
});
