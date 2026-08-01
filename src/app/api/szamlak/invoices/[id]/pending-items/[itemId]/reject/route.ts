import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";
import type { PendingPriceItem } from "@/lib/invoiceProcessing";

// Discards a held-back price jump without ever creating a PriceObservation -
// for when the owner looks at the photo and confirms it really was a misread.
export const POST = withApiErrorHandling(async (
  _request: Request,
  ctx: RouteContext<"/api/szamlak/invoices/[id]/pending-items/[itemId]/reject">
) => {
  const { id, itemId } = await ctx.params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "Nem található" }, { status: 404 });
  }

  const pending = (invoice.pendingLineItems as unknown as PendingPriceItem[] | null) ?? [];
  if (!pending.some((p) => p.id === itemId)) {
    return NextResponse.json({ error: "Nem található" }, { status: 404 });
  }

  const remaining = pending.filter((p) => p.id !== itemId);
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pendingLineItems: remaining },
  });

  return NextResponse.json(updatedInvoice);
});
