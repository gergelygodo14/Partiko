import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay } from "@/lib/dates";
import { emptyWeek } from "@/lib/weeklyMenu";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const PATCH = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { weekStart, published } = body as { weekStart: string; published: boolean };

  if (!isValidDateStr(weekStart) || typeof published !== "boolean") {
    return NextResponse.json(
      { error: "weekStart és published (boolean) kötelező" },
      { status: 400 }
    );
  }

  const week = mondayOf(weekStart);
  const menu = await prisma.weeklyMenu.upsert({
    where: { weekStart: parseDay(week) },
    update: { published, ...(published ? { publishedAt: new Date() } : {}) },
    create: {
      weekStart: parseDay(week),
      days: emptyWeek(),
      published,
      ...(published ? { publishedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({
    weekStart: week,
    published: menu.published,
    publishedAt: menu.publishedAt,
  });
});
