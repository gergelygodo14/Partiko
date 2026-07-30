import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import {
  deleteFixOrder,
  getFixOrdersForWeekday,
  saveFixOrdersForWeekday,
  type FixOrderSaveInput,
} from "@/lib/sandwichFixOrders";
import { isValidSandwichOrderItems } from "@/lib/sandwichOrders";
import { WEEKDAY_COUNT } from "@/lib/weekdays";

// Session-gated (see the note in ../day/route.ts). Fix orders are templates,
// never real orders: they carry no date and no price snapshot, and no summary
// or export ever reads them.

function parseWeekday(value: string | null): number | null {
  if (value === null) return null;
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday >= WEEKDAY_COUNT) return null;
  return weekday;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const weekday = parseWeekday(request.nextUrl.searchParams.get("weekday"));
  if (weekday === null) {
    return NextResponse.json({ error: "Érvényes weekday (0-4) kötelező" }, { status: 400 });
  }
  return NextResponse.json({ weekday, stores: await getFixOrdersForWeekday(weekday) });
});

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { weekday: rawWeekday, stores } = body as { weekday?: unknown; stores?: unknown };

  const weekday = parseWeekday(typeof rawWeekday === "number" ? String(rawWeekday) : null);
  if (weekday === null) {
    return NextResponse.json({ error: "Érvényes weekday (0-4) kötelező" }, { status: 400 });
  }
  if (!Array.isArray(stores)) {
    return NextResponse.json({ error: "stores tömb kötelező" }, { status: 400 });
  }

  const parsed: FixOrderSaveInput[] = [];
  for (const store of stores) {
    if (typeof store !== "object" || store === null) {
      return NextResponse.json({ error: "Érvénytelen bolt a stores tömbben" }, { status: 400 });
    }
    const { customerId, items, active } = store as Record<string, unknown>;
    if (typeof customerId !== "string" || customerId.length === 0) {
      return NextResponse.json({ error: "customerId kötelező minden boltnál" }, { status: 400 });
    }
    if (!isValidSandwichOrderItems(items)) {
      return NextResponse.json({ error: `Érvénytelen items tömb (${customerId})` }, { status: 400 });
    }
    if (active !== undefined && typeof active !== "boolean") {
      return NextResponse.json({ error: "active csak boolean lehet" }, { status: 400 });
    }
    parsed.push({ customerId, items, active: active as boolean | undefined });
  }

  return NextResponse.json(await saveFixOrdersForWeekday(weekday, parsed));
});

export const DELETE = withApiErrorHandling(async (request: NextRequest) => {
  const weekday = parseWeekday(request.nextUrl.searchParams.get("weekday"));
  const customerId = request.nextUrl.searchParams.get("customerId");
  if (weekday === null || !customerId) {
    return NextResponse.json(
      { error: "Érvényes weekday (0-4) és customerId kötelező" },
      { status: 400 }
    );
  }
  await deleteFixOrder(weekday, customerId);
  return NextResponse.json({ weekday, customerId, deleted: true });
});
