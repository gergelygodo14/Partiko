import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay, todayStr } from "@/lib/dates";
import { emptyWeek, type MenuDay } from "@/lib/weeklyMenu";
import { isValidDateStr, isValidMenuDay } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const weekParam = request.nextUrl.searchParams.get("week") ?? todayStr();
  if (!isValidDateStr(weekParam)) {
    return NextResponse.json({ error: "Érvénytelen week" }, { status: 400 });
  }
  const week = mondayOf(weekParam);

  const menu = await prisma.weeklyMenu.findUnique({
    where: { weekStart: parseDay(week) },
  });

  return NextResponse.json({
    weekStart: week,
    days: (menu?.days as MenuDay[] | undefined) ?? emptyWeek(),
  });
});

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { weekStart, days } = body as { weekStart: string; days: MenuDay[] };

  if (
    !isValidDateStr(weekStart) ||
    !Array.isArray(days) ||
    days.length !== 5 ||
    !days.every(isValidMenuDay)
  ) {
    return NextResponse.json(
      { error: "weekStart és 5 elemű, érvényes days tömb kötelező" },
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
});
