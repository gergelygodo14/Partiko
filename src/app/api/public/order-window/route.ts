import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDaysStr, getActiveOrderWeek, getLockedDayIndexes, parseDay } from "@/lib/dates";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    void request;
    const now = new Date();
    const activeWeek = getActiveOrderWeek(now);
    const menu = await prisma.weeklyMenu.findUnique({
      where: { weekStart: parseDay(activeWeek.weekStart) },
    });

    return NextResponse.json({
      weekStart: activeWeek.weekStart,
      weekEnd: addDaysStr(activeWeek.weekStart, 4),
      isOpen: menu?.published ?? false,
      lockedDayIndexes: getLockedDayIndexes(activeWeek, now),
    });
  })
);
