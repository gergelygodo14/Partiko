import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOf, parseDay, todayStr } from "@/lib/dates";
import { emptyWeek, type MenuDay } from "@/lib/weeklyMenu";
import { generateMenuDocx } from "@/lib/generateMenuDocx";
import { isValidDateStr } from "@/lib/validate";
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
  const days = (menu?.days as MenuDay[] | undefined) ?? emptyWeek();

  const buffer = await generateMenuDocx(week, days);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="heti_menu_${week}.docx"`,
    },
  });
});
