import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveOrderWeek, getLockedDayIndexes, mondayOf, parseDay } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import {
  applyLockedDays,
  daysGridToOrderLines,
  emptyOrderWeek,
  isValidOrderDays,
  orderLinesToDaysGrid,
  type OrderDayQuantities,
} from "@/lib/orders";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, PUT, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const customerId = request.nextUrl.searchParams.get("customerId");
    const weekParam = request.nextUrl.searchParams.get("week");

    if (!customerId || !weekParam || !isValidDateStr(weekParam)) {
      return NextResponse.json(
        { error: "customerId és érvényes week kötelező" },
        { status: 400 }
      );
    }
    const week = mondayOf(weekParam);

    const order = await prisma.order.findUnique({
      where: { customerId_weekStart: { customerId, weekStart: parseDay(week) } },
      include: { lines: true },
    });

    return NextResponse.json({
      weekStart: week,
      days: order ? orderLinesToDaysGrid(order.lines) : emptyOrderWeek(),
    });
  })
);

export const PUT = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const body = await request.json();
    const { customerId, weekStart, days } = body as {
      customerId: string;
      weekStart: string;
      days: OrderDayQuantities[];
    };

    if (
      typeof customerId !== "string" ||
      !customerId ||
      !isValidDateStr(weekStart) ||
      !isValidOrderDays(days)
    ) {
      return NextResponse.json(
        { error: "customerId, weekStart és 5 elemű, érvényes days tömb kötelező" },
        { status: 400 }
      );
    }

    const week = mondayOf(weekStart);

    // Authority check: only accept writes into the currently active,
    // published ordering week. Rejects a stale client tab left open across
    // a Thursday-10:00 cutover (or a publish toggled back off) rather than
    // silently writing into a week that should no longer be editable.
    const now = new Date();
    const activeWeek = getActiveOrderWeek(now);
    if (week !== activeWeek.weekStart) {
      return NextResponse.json({ error: "A rendelési időszak lezárult" }, { status: 409 });
    }
    const menu = await prisma.weeklyMenu.findUnique({ where: { weekStart: parseDay(week) } });
    if (!menu?.published) {
      return NextResponse.json({ error: "A rendelési időszak lezárult" }, { status: 409 });
    }

    const lockedDayIndexes = getLockedDayIndexes(activeWeek, now);
    const weekStartDate = parseDay(week);

    const finalDays = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { customerId_weekStart: { customerId, weekStart: weekStartDate } },
        include: { lines: true },
      });
      const existingDays = existingOrder
        ? orderLinesToDaysGrid(existingOrder.lines)
        : emptyOrderWeek();
      const merged = applyLockedDays(days, existingDays, lockedDayIndexes);

      const order = await tx.order.upsert({
        where: { customerId_weekStart: { customerId, weekStart: weekStartDate } },
        update: {},
        create: { customerId, weekStart: weekStartDate },
      });

      await tx.orderLine.deleteMany({ where: { orderId: order.id } });
      const lines = daysGridToOrderLines(merged);
      if (lines.length > 0) {
        await tx.orderLine.createMany({
          data: lines.map((line) => ({ orderId: order.id, ...line })),
        });
      }

      return merged;
    });

    return NextResponse.json({ weekStart: week, days: finalDays });
  })
);
