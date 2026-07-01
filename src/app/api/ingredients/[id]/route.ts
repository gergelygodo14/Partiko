import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/ingredients/[id]">
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const { name, unit, unitPrice, order, archived } = body;

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
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/ingredients/[id]">
) {
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
}
