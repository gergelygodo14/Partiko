import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const includeArchived = request.nextUrl.searchParams.get("all") === "true";
  const items = await prisma.sandwichItem.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { name, price, profitFt } = body;

  if (typeof name !== "string" || !name || !Number.isInteger(price)) {
    return NextResponse.json(
      { error: "name és price (egész szám) mezők kötelezők" },
      { status: 400 }
    );
  }
  if (profitFt !== undefined && !Number.isInteger(profitFt)) {
    return NextResponse.json({ error: "Érvénytelen profitFt" }, { status: 400 });
  }

  const last = await prisma.sandwichItem.findFirst({ orderBy: { order: "desc" } });
  const item = await prisma.sandwichItem.create({
    data: { name, price, profitFt: profitFt ?? 0, order: (last?.order ?? 0) + 1 },
  });
  return NextResponse.json(item, { status: 201 });
});
