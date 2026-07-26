import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/sandwich-items/[id]">
) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { name, price, order, archived } = body;

  if (name !== undefined && (typeof name !== "string" || !name)) {
    return NextResponse.json({ error: "Érvénytelen name" }, { status: 400 });
  }
  if (price !== undefined && !Number.isInteger(price)) {
    return NextResponse.json({ error: "Érvénytelen price" }, { status: 400 });
  }
  if (order !== undefined && !Number.isInteger(order)) {
    return NextResponse.json({ error: "Érvénytelen order" }, { status: 400 });
  }
  if (archived !== undefined && typeof archived !== "boolean") {
    return NextResponse.json({ error: "Érvénytelen archived" }, { status: 400 });
  }

  const item = await prisma.sandwichItem.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(archived !== undefined ? { archived } : {}),
    },
  });
  return NextResponse.json(item);
});

export const DELETE = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/sandwich-items/[id]">
) => {
  const { id } = await ctx.params;

  const lineCount = await prisma.sandwichOrderLine.count({ where: { itemId: id } });
  if (lineCount > 0) {
    const item = await prisma.sandwichItem.update({
      where: { id },
      data: { archived: true },
    });
    return NextResponse.json({ item, archived: true });
  }

  await prisma.sandwichItem.delete({ where: { id } });
  return NextResponse.json({ archived: false }, { status: 200 });
});
