import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const includeArchived = request.nextUrl.searchParams.get("all") === "true";
  const ingredients = await prisma.ingredient.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(ingredients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, unit, unitPrice } = body;

  if (!name || !unit || typeof unitPrice !== "number") {
    return NextResponse.json(
      { error: "name, unit és unitPrice mezők kötelezők" },
      { status: 400 }
    );
  }

  const last = await prisma.ingredient.findFirst({ orderBy: { order: "desc" } });
  const ingredient = await prisma.ingredient.create({
    data: { name, unit, unitPrice, order: (last?.order ?? 0) + 1 },
  });
  return NextResponse.json(ingredient, { status: 201 });
}
