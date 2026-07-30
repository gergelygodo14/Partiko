import { NextRequest, NextResponse } from "next/server";
import type { StoreGroup } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { prisma } from "@/lib/db";
import { STORE_GROUP_ORDER } from "@/lib/sandwichStoreGroups";

type Context = { params: Promise<{ id: string }> };

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
