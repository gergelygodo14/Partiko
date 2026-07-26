import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import { getSandwichOrderTargetDay } from "@/lib/sandwichDates";
import {
  buildSandwichOrderLines,
  isValidSandwichOrderItems,
  type SandwichOrderItemInput,
} from "@/lib/sandwichOrders";
import { buildSandwichOrderNotificationText } from "@/lib/sandwichOrderNotification";
import { sendTelegramMessage } from "@/lib/telegram";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, PUT, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const customerId = request.nextUrl.searchParams.get("customerId");
    const dateParam = request.nextUrl.searchParams.get("date");

    if (!customerId || !dateParam || !isValidDateStr(dateParam)) {
      return NextResponse.json({ error: "customerId és érvényes date kötelező" }, { status: 400 });
    }

    const order = await prisma.sandwichOrder.findUnique({
      where: { customerId_orderDate: { customerId, orderDate: parseDay(dateParam) } },
      include: { lines: true },
    });

    return NextResponse.json({
      orderDate: dateParam,
      items: order ? order.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })) : [],
    });
  })
);

export const PUT = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const body = await request.json();
    const { customerId, orderDate, items } = body as {
      customerId: string;
      orderDate: string;
      items: SandwichOrderItemInput[];
    };

    if (
      typeof customerId !== "string" ||
      !customerId ||
      !isValidDateStr(orderDate) ||
      !isValidSandwichOrderItems(items)
    ) {
      return NextResponse.json(
        { error: "customerId, orderDate és érvényes items tömb kötelező" },
        { status: 400 }
      );
    }

    // Authority check: only accept writes into the currently active target
    // day - rejects a stale client tab left open across the daily cutoff.
    const target = getSandwichOrderTargetDay();
    if (orderDate !== target.date) {
      return NextResponse.json({ error: "A rendelési időszak lezárult" }, { status: 409 });
    }

    const catalogItems = await prisma.sandwichItem.findMany({ where: { archived: false } });
    const priceByItemId = new Map(catalogItems.map((item) => [item.id, item.price]));
    const nameByItemId = new Map(catalogItems.map((item) => [item.id, item.name]));
    const lines = buildSandwichOrderLines(items, priceByItemId);

    const orderDateValue = parseDay(orderDate);
    let isNewOrder = false;
    await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.sandwichOrder.findUnique({
        where: { customerId_orderDate: { customerId, orderDate: orderDateValue } },
      });
      isNewOrder = !existingOrder;

      const order = await tx.sandwichOrder.upsert({
        where: { customerId_orderDate: { customerId, orderDate: orderDateValue } },
        update: {},
        create: { customerId, orderDate: orderDateValue },
      });

      await tx.sandwichOrderLine.deleteMany({ where: { orderId: order.id } });
      if (lines.length > 0) {
        await tx.sandwichOrderLine.createMany({
          data: lines.map((line) => ({ orderId: order.id, ...line })),
        });
      }
    });

    // Best-effort - a Telegram/notification failure must never fail the
    // customer's order submission.
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { storeName: true },
      });
      if (customer) {
        const text = buildSandwichOrderNotificationText({
          storeName: customer.storeName,
          orderDate,
          dayName: target.dayName,
          lines: lines.map((line) => ({
            itemName: nameByItemId.get(line.itemId) ?? line.itemId,
            quantity: line.quantity,
            unitPriceFt: line.unitPriceFt,
          })),
          isNew: isNewOrder,
        });
        const result = await sendTelegramMessage(text);
        if (!result.ok) {
          console.error("Telegram sandwich order notification failed:", result.error);
        }
      }
    } catch (e) {
      console.error("Telegram sandwich order notification failed:", e);
    }

    return NextResponse.json({
      orderDate,
      items: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
    });
  })
);
