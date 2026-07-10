import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProductStatus } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/szamlak/products/[id]">
) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { name, unit, status } = body;

  if (name !== undefined && (typeof name !== "string" || !name)) {
    return NextResponse.json({ error: "Érvénytelen name" }, { status: 400 });
  }
  if (unit !== undefined && typeof unit !== "string") {
    return NextResponse.json({ error: "Érvénytelen unit" }, { status: 400 });
  }
  if (
    status !== undefined &&
    status !== ProductStatus.PENDING &&
    status !== ProductStatus.CONFIRMED
  ) {
    return NextResponse.json({ error: "Érvénytelen status" }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });
  return NextResponse.json(product);
});
