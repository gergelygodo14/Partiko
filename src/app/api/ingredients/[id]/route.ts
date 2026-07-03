import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/ingredients/[id]">
) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { name, unit, unitPrice, order, archived } = body;

  if (name !== undefined && (typeof name !== "string" || !name)) {
    return NextResponse.json({ error: "Érvénytelen name" }, { status: 400 });
  }
  if (unit !== undefined && (typeof unit !== "string" || !unit)) {
    return NextResponse.json({ error: "Érvénytelen unit" }, { status: 400 });
  }
  if (unitPrice !== undefined && !Number.isInteger(unitPrice)) {
    return NextResponse.json({ error: "Érvénytelen unitPrice" }, { status: 400 });
  }
  if (order !== undefined && !Number.isInteger(order)) {
    return NextResponse.json({ error: "Érvénytelen order" }, { status: 400 });
  }
  if (archived !== undefined && typeof archived !== "boolean") {
    return NextResponse.json({ error: "Érvénytelen archived" }, { status: 400 });
  }

  const ingredient = await prisma.ingredient.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(archived !== undefined ? { archived } : {}),
    },
  });
  return NextResponse.json(ingredient);
});

export const DELETE = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/ingredients/[id]">
) => {
  const { id } = await ctx.params;

  const entryCount = await prisma.entry.count({ where: { ingredientId: id } });
  if (entryCount > 0) {
    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: { archived: true },
    });
    return NextResponse.json({ ingredient, archived: true });
  }

  await prisma.ingredient.delete({ where: { id } });
  return NextResponse.json({ archived: false }, { status: 200 });
});
