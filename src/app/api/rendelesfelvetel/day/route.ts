import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { addDaysStr, budapestTodayStr } from "@/lib/dates";
import { prisma } from "@/lib/db";
import {
  getSandwichDayGrid,
  saveSandwichDayGrid,
  type DaySaveStoreInput,
} from "@/lib/sandwichDayGrid";
import { isValidSandwichOrderItems } from "@/lib/sandwichOrders";
import { isValidDateStr } from "@/lib/validate";
import { weekdayIndexOf } from "@/lib/weekdays";

// Staff-only order entry. Deliberately NOT under /api/public/ and deliberately
// NOT CORS-wrapped: proxy.ts puts everything outside PUBLIC_API_PREFIXES behind
// the session cookie, and that is the whole access control for this route.
//
// This is the only write path that accepts an arbitrary weekday.
// PUT /api/public/sandwich/orders still rejects anything other than
// getSandwichOrderTargetDay() with a 409, and is not touched by this feature.

// Guards against a fat-fingered year writing 2027 data into production. Wide
// enough for the real workflow (recording yesterday's calls, planning next
// week) and narrow enough that a typo cannot land somewhere nobody looks.
const MAX_DAYS_FROM_TODAY = 31;

function validateDate(dateParam: string | null): { date: string; weekday: number } | NextResponse {
  if (!dateParam || !isValidDateStr(dateParam)) {
    return NextResponse.json({ error: "Érvényes date paraméter kötelező" }, { status: 400 });
  }
  const weekday = weekdayIndexOf(dateParam);
  if (weekday === null) {
    return NextResponse.json(
      { error: "Hétvégére nincs kiszállítás, csak hétfő-péntek adható meg" },
      { status: 400 }
    );
  }
  const today = budapestTodayStr();
  if (
    dateParam < addDaysStr(today, -MAX_DAYS_FROM_TODAY) ||
    dateParam > addDaysStr(today, MAX_DAYS_FROM_TODAY)
  ) {
    return NextResponse.json({ error: "Ez a dátum túl messze van (elgépelés?)" }, { status: 409 });
  }
  return { date: dateParam, weekday };
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const validated = validateDate(request.nextUrl.searchParams.get("date"));
  if (validated instanceof NextResponse) return validated;

  return NextResponse.json(await getSandwichDayGrid(validated.date));
});

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { date, stores } = body as { date?: unknown; stores?: unknown };

  const validated = validateDate(typeof date === "string" ? date : null);
  if (validated instanceof NextResponse) return validated;

  if (!Array.isArray(stores)) {
    return NextResponse.json({ error: "stores tömb kötelező" }, { status: 400 });
  }

  const parsed: DaySaveStoreInput[] = [];
  for (const store of stores) {
    if (typeof store !== "object" || store === null) {
      return NextResponse.json({ error: "Érvénytelen bolt a stores tömbben" }, { status: 400 });
    }
    const { customerId, items } = store as Record<string, unknown>;
    if (typeof customerId !== "string" || customerId.length === 0) {
      return NextResponse.json({ error: "customerId kötelező minden boltnál" }, { status: 400 });
    }
    if (!isValidSandwichOrderItems(items)) {
      return NextResponse.json(
        { error: `Érvénytelen items tömb (${customerId})` },
        { status: 400 }
      );
    }
    parsed.push({ customerId, items });
  }

  // One upfront existence check instead of letting an unknown id blow up as a
  // P2003 halfway through the transaction, where some stores would already
  // have been written.
  const customerIds = [...new Set(parsed.map((store) => store.customerId))];
  if (customerIds.length > 0) {
    const known = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true },
    });
    if (known.length !== customerIds.length) {
      const knownIds = new Set(known.map((customer) => customer.id));
      const missing = customerIds.filter((id) => !knownIds.has(id));
      return NextResponse.json(
        { error: `Ismeretlen bolt: ${missing.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const result = await saveSandwichDayGrid(validated.date, parsed);

  return NextResponse.json(result);
});
