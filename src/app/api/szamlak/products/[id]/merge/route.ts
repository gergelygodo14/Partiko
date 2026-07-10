import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProductStatus } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/szamlak/products/[id]/merge">
) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { intoProductId } = body;

  if (typeof intoProductId !== "string" || !intoProductId) {
    return NextResponse.json({ error: "Érvénytelen intoProductId" }, { status: 400 });
  }
  if (intoProductId === id) {
    return NextResponse.json(
      { error: "Egy termék nem olvasztható össze önmagával" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.priceObservation.updateMany({
      where: { productId: id },
      data: { productId: intoProductId },
    }),
    prisma.product.update({
      where: { id: intoProductId },
      data: { status: ProductStatus.CONFIRMED },
    }),
    prisma.product.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
});
