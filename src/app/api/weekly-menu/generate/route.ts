import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay, todayStr } from "@/lib/dates";
import { emptyWeek, type MenuDay } from "@/lib/weeklyMenu";
import { generateMenuDocx } from "@/lib/generateMenuDocx";

export async function GET(request: NextRequest) {
  const week = mondayOf(request.nextUrl.searchParams.get("week") ?? todayStr());

  const menu = await prisma.weeklyMenu.findUnique({
    where: { weekStart: parseDay(week) },
  });
  const days = (menu?.days as MenuDay[] | undefined) ?? emptyWeek();

  const buffer = await generateMenuDocx(week, days);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="heti_menu_${week}.docx"`,
    },
  });
}
