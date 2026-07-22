import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProductStatus } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";

function isValidStatus(value: unknown): value is ProductStatus {
  return value === ProductStatus.PENDING || value === ProductStatus.CONFIRMED;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const statusParam = request.nextUrl.searchParams.get("status");
  if (statusParam !== null && !isValidStatus(statusParam)) {
    return NextResponse.json({ error: "Érvénytelen status" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: statusParam ? { status: statusParam } : undefined,
    orderBy: { createdAt: "desc" },
    include: { priceObservations: { orderBy: { observedDate: "desc" }, take: 1 } },
  });
  return NextResponse.json(products);
});
