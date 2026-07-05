import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay, todayStr } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import type { MenuDay } from "@/lib/weeklyMenu";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const weekParam = request.nextUrl.searchParams.get("week") ?? todayStr();
    if (!isValidDateStr(weekParam)) {
      return NextResponse.json({ error: "Érvénytelen week" }, { status: 400 });
    }
    const week = mondayOf(weekParam);

    const menu = await prisma.weeklyMenu.findUnique({
      where: { weekStart: parseDay(week) },
    });

    // Re-checked server-side regardless of what /api/public/order-window
    // said, so a draft menu is never leaked even mid-edit by the owner.
    if (!menu?.published) {
      return NextResponse.json({ weekStart: week, published: false });
    }

    return NextResponse.json({
      weekStart: week,
      published: true,
      days: menu.days as MenuDay[],
    });
  })
);
