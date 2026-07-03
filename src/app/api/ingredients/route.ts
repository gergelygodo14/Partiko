import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const includeArchived = request.nextUrl.searchParams.get("all") === "true";
  const ingredients = await prisma.ingredient.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(ingredients);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { name, unit, unitPrice } = body;

  if (
    typeof name !== "string" ||
    !name ||
    typeof unit !== "string" ||
    !unit ||
    !Number.isInteger(unitPrice)
  ) {
    return NextResponse.json(
      { error: "name, unit és unitPrice (egész szám) mezők kötelezők" },
      { status: 400 }
    );
  }

  const last = await prisma.ingredient.findFirst({ orderBy: { order: "desc" } });
  const ingredient = await prisma.ingredient.create({
    data: { name, unit, unitPrice, order: (last?.order ?? 0) + 1 },
  });
  return NextResponse.json(ingredient, { status: 201 });
});
