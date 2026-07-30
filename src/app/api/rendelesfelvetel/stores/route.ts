import { NextRequest, NextResponse } from "next/server";
import type { StoreGroup } from "@/generated/prisma/client";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { prisma } from "@/lib/db";
import { compareStoresForGrid, STORE_GROUP_ORDER, suggestStoreGroup } from "@/lib/sandwichStoreGroups";

// Every customer, for the "add a column that isn't usually on this day" picker.
export const GET = withApiErrorHandling(async () => {
  const customers = await prisma.customer.findMany({
    select: { id: true, storeName: true, storeGroup: true, storeOrder: true },
  });

  return NextResponse.json({
    stores: customers
      .map((customer) => ({
        customerId: customer.id,
        storeName: customer.storeName,
        storeGroup: customer.storeGroup,
        storeOrder: customer.storeOrder,
      }))
      .sort(compareStoresForGrid),
  });
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { storeName, storeGroup } = body as { storeName?: unknown; storeGroup?: unknown };

  if (typeof storeName !== "string" || storeName.trim().length === 0) {
    return NextResponse.json({ error: "Megrendelő/bolt neve kötelező" }, { status: 400 });
  }
  if (storeGroup !== undefined && !STORE_GROUP_ORDER.includes(storeGroup as StoreGroup)) {
    return NextResponse.json({ error: "Érvénytelen storeGroup" }, { status: 400 });
  }

  const name = storeName.trim();

  // Same case-insensitive find-or-create convention as /api/public/customers,
  // so adding a store here can never fork an existing one.
  const existing = await prisma.customer.findFirst({
    where: { storeName: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({
      customerId: existing.id,
      storeName: existing.storeName,
      storeGroup: existing.storeGroup,
      storeOrder: existing.storeOrder,
      created: false,
    });
  }

  // New stores sort to the end of their group rather than jumping into the
  // owner's established column order.
  const last = await prisma.customer.findFirst({
    orderBy: { storeOrder: "desc" },
    select: { storeOrder: true },
  });

  const created = await prisma.customer.create({
    data: {
      storeName: name,
      companyName: "",
      storeGroup: (storeGroup as StoreGroup | undefined) ?? suggestStoreGroup(name),
      storeOrder: (last?.storeOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({
    customerId: created.id,
    storeName: created.storeName,
    storeGroup: created.storeGroup,
    storeOrder: created.storeOrder,
    created: true,
  });
});
