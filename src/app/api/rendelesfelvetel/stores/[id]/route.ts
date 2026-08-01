import { NextRequest, NextResponse } from "next/server";
import type { StoreGroup } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { prisma } from "@/lib/db";
import { STORE_GROUP_ORDER } from "@/lib/sandwichStoreGroups";
import {
  ALL_WEEKDAYS,
  deleteStoreCompletely,
  getStoreRemovalInfo,
  removeStoreFromRounds,
} from "@/lib/sandwichStoreRoster";
import { isValidDateStr } from "@/lib/validate";
import { WEEKDAY_COUNT } from "@/lib/weekdays";

type Context = { params: Promise<{ id: string }> };

/** What removing this store would actually cost - drives the confirm dialog, so
 *  the owner sees the order count before deciding, not after. */
export const GET = withApiErrorHandling(async (request: NextRequest, ctx: Context) => {
  const { id } = await ctx.params;
  const date = request.nextUrl.searchParams.get("date");
  if (date !== null && !isValidDateStr(date)) {
    return NextResponse.json({ error: "Érvénytelen date paraméter" }, { status: 400 });
  }

  const info = await getStoreRemovalInfo(id, date);
  if (!info) return NextResponse.json({ error: "Nem található bolt" }, { status: 404 });
  return NextResponse.json(info);
});

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: Context) => {
  // Next 16: route params are a Promise.
  const { id } = await ctx.params;
  const body = await request.json();
  const { storeGroup, storeOrder } = body as { storeGroup?: unknown; storeOrder?: unknown };

  const data: { storeGroup?: StoreGroup; storeOrder?: number } = {};

  if (storeGroup !== undefined) {
    if (!STORE_GROUP_ORDER.includes(storeGroup as StoreGroup)) {
      return NextResponse.json({ error: "Érvénytelen storeGroup" }, { status: 400 });
    }
    data.storeGroup = storeGroup as StoreGroup;
  }
  if (storeOrder !== undefined) {
    if (!Number.isInteger(storeOrder)) {
      return NextResponse.json({ error: "storeOrder csak egész szám lehet" }, { status: 400 });
    }
    data.storeOrder = storeOrder as number;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nincs módosítandó mező" }, { status: 400 });
  }

  const updated = await prisma.customer.update({ where: { id }, data });

  return NextResponse.json({
    customerId: updated.id,
    storeName: updated.storeName,
    storeGroup: updated.storeGroup,
    storeOrder: updated.storeOrder,
  });
});

/** Three different removals, spelled out in the query rather than guessed:
 *
 *  - `scope=weekday&weekday=2`  off Wednesday's round only
 *  - `scope=allWeekdays`        off every day's round, customer row kept
 *  - `scope=customer`           delete the customer outright (no orders only)
 *
 *  The first two take `date` as well, and delete that date's order along with
 *  the column - see removeStoreFromRounds for why. */
export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: Context) => {
  const { id } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const scope = params.get("scope");
  const date = params.get("date");

  if (date !== null && !isValidDateStr(date)) {
    return NextResponse.json({ error: "Érvénytelen date paraméter" }, { status: 400 });
  }

  if (scope === "customer") {
    const result = await deleteStoreCompletely(id);
    if (!result.deleted) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json({ customerId: id, deletedCustomer: true });
  }

  if (scope === "weekday") {
    const weekday = Number(params.get("weekday"));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday >= WEEKDAY_COUNT) {
      return NextResponse.json({ error: "Érvényes weekday (0-4) kötelező" }, { status: 400 });
    }
    return NextResponse.json({
      customerId: id,
      deletedCustomer: false,
      ...(await removeStoreFromRounds(id, [weekday], date)),
    });
  }

  if (scope === "allWeekdays") {
    return NextResponse.json({
      customerId: id,
      deletedCustomer: false,
      ...(await removeStoreFromRounds(id, ALL_WEEKDAYS, date)),
    });
  }

  return NextResponse.json(
    { error: "scope csak weekday, allWeekdays vagy customer lehet" },
    { status: 400 }
  );
});
