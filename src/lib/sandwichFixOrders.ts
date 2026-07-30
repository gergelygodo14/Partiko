import type { StoreGroup } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import type { SandwichOrderItemInput } from "@/lib/sandwichOrders";
import { compareStoresForGrid } from "@/lib/sandwichStoreGroups";

export type FixOrderStore = {
  customerId: string;
  storeName: string;
  storeGroup: StoreGroup;
  storeOrder: number;
  active: boolean;
  items: Record<string, number>;
};

export async function getFixOrdersForWeekday(weekday: number): Promise<FixOrderStore[]> {
  const fixOrders = await prisma.sandwichFixOrder.findMany({
    where: { weekday },
    include: { customer: true, lines: true },
  });

  return fixOrders
    .map((fixOrder) => ({
      customerId: fixOrder.customerId,
      storeName: fixOrder.customer.storeName,
      storeGroup: fixOrder.customer.storeGroup,
      storeOrder: fixOrder.customer.storeOrder,
      active: fixOrder.active,
      items: Object.fromEntries(
        fixOrder.lines.filter((line) => line.quantity > 0).map((line) => [line.itemId, line.quantity])
      ),
    }))
    .sort(compareStoresForGrid);
}

export type FixOrderSaveInput = {
  customerId: string;
  items: SandwichOrderItemInput[];
  /** Omit to leave membership as-is; false removes the store from this
   *  weekday's round without discarding its stored quantities. */
  active?: boolean;
};

/** Partial upsert, same contract as the day grid: stores not listed are left
 *  alone. An empty `items` array keeps the SandwichFixOrder row (the store
 *  stays on the round) but drops its lines - unlike the day grid, where empty
 *  means delete, because here roster membership is itself the information. */
export async function saveFixOrdersForWeekday(
  weekday: number,
  stores: FixOrderSaveInput[]
): Promise<{ weekday: number; savedCount: number }> {
  const catalogItems = await prisma.sandwichItem.findMany({
    where: { archived: false },
    select: { id: true },
  });
  const knownItemIds = new Set(catalogItems.map((item) => item.id));

  await prisma.$transaction(
    async (tx) => {
      for (const store of stores) {
        const lines = store.items
          .filter((item) => item.quantity > 0 && knownItemIds.has(item.itemId))
          .map((item) => ({ itemId: item.itemId, quantity: item.quantity }));

        const fixOrder = await tx.sandwichFixOrder.upsert({
          where: { customerId_weekday: { customerId: store.customerId, weekday } },
          update: store.active === undefined ? {} : { active: store.active },
          create: {
            customerId: store.customerId,
            weekday,
            active: store.active ?? true,
          },
          select: { id: true },
        });

        await tx.sandwichFixOrderLine.deleteMany({ where: { fixOrderId: fixOrder.id } });
        if (lines.length > 0) {
          await tx.sandwichFixOrderLine.createMany({
            data: lines.map((line) => ({ fixOrderId: fixOrder.id, ...line })),
          });
        }
      }
    },
    { timeout: 20_000, maxWait: 10_000 }
  );

  return { weekday, savedCount: stores.length };
}

/** "Make what is currently on the grid the fix order for this weekday."
 *  Reads the stored orders for `date` (not the client's unsaved draft - the
 *  owner has to send first, so a template can never capture a half-typed
 *  column) and copies them into that date's weekday templates. */
export async function copyDayIntoFixOrders(
  date: string,
  weekday: number,
  customerIds?: string[]
): Promise<{ weekday: number; savedCount: number }> {
  const orders = await prisma.sandwichOrder.findMany({
    where: {
      orderDate: parseDay(date),
      ...(customerIds && customerIds.length > 0 ? { customerId: { in: customerIds } } : {}),
    },
    include: { lines: true },
  });

  return saveFixOrdersForWeekday(
    weekday,
    orders.map((order) => ({
      customerId: order.customerId,
      items: order.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      active: true,
    }))
  );
}

export async function deleteFixOrder(weekday: number, customerId: string): Promise<void> {
  await prisma.sandwichFixOrder.deleteMany({ where: { weekday, customerId } });
}
