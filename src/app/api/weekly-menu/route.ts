import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay, todayStr } from "@/lib/dates";
import { emptyWeek, type MenuDay } from "@/lib/weeklyMenu";

export async function GET(request: NextRequest) {
  const week = mondayOf(request.nextUrl.searchParams.get("week") ?? todayStr());

  const menu = await prisma.weeklyMenu.findUnique({
    where: { weekStart: parseDay(week) },
  });

  return NextResponse.json({
    weekStart: week,
    days: (menu?.days as MenuDay[] | undefined) ?? emptyWeek(),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { weekStart, days } = body as { weekStart: string; days: MenuDay[] };

  if (!weekStart || !Array.isArray(days) || days.length !== 5) {
    return NextResponse.json(
      { error: "weekStart és 5 elemű days tömb kötelező" },
      { status: 400 }
    );
  }

  const week = mondayOf(weekStart);
  const menu = await prisma.weeklyMenu.upsert({
    where: { weekStart: parseDay(week) },
    update: { days },
    create: { weekStart: parseDay(week), days },
  });

  return NextResponse.json({ weekStart: week, days: menu.days });
}
