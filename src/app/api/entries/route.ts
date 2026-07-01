import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dayRange, todayStr } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayStr();
  const { gte, lt } = dayRange(date);

  const entries = await prisma.entry.findMany({
    where: { date: { gte, lt } },
    include: { ingredient: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ingredientId, date, quantity } = body;

  if (!ingredientId || !date || typeof quantity !== "number" || quantity <= 0) {
    return NextResponse.json(
      { error: "ingredientId, date és quantity (pozitív szám) mezők kötelezők" },
      { status: 400 }
    );
  }

  const entry = await prisma.entry.create({
    data: {
      ingredientId,
      date: new Date(`${date}T00:00:00.000Z`),
      quantity,
    },
    include: { ingredient: true },
  });
  return NextResponse.json(entry, { status: 201 });
}
