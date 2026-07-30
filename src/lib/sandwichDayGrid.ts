import type { StoreGroup } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import { excelLabelFor } from "@/lib/sandwichItemLabels";
import { buildSandwichOrderLines, type SandwichOrderItemInput } from "@/lib/sandwichOrders";
import { compareStoresForGrid } from "@/lib/sandwichStoreGroups";
import { weekdayIndexOf } from "@/lib/weekdays";

export type GridItem = {
  itemId: string;
  name: string;
  /** The kitchen's own shorthand ("RHZS PAPUCS"), which is what the owner
   *  recognizes on the sheet - falls back to the full catalog name. */
  shortLabel: string;
  order: number;
  price: number;
};

export type GridStore = {
  customerId: string;
  storeName: string;
  storeGroup: StoreGroup;
  storeOrder: number;
  /** Has an active fix order for this weekday, i.e. is on the day's round. */
  onFixList: boolean;
  /** What is currently stored for this date - the server baseline. */
  saved: Record<string, number>;
  /** This weekday's template, for the "load fix order" action. */
  fix: Record<string, number>;
};

export type SandwichDayGrid = {
  date: string;
  weekday: number;
  items: GridItem[];
  stores: GridStore[];
  /** Newest updatedAt across the date's orders; lets the client notice that
   *  someone else (a self-service customer) wrote while it held a draft. */
  savedAt: string | null;
};

/** Everything the order-entry screen needs for one weekday, in one query set:
 *  the full active catalog, plus every store that is either on that weekday's
 *  fix-order round or already has an order on that date. */
export async function getSandwichDayGrid(date: string): Promise<SandwichDayGrid> {
  const weekday = weekdayIndexOf(date);
  if (weekday === null) throw new Error(`${date} nem hétköznap`);

  const [items, fixOrders, orders] = await Promise.all([
    prisma.sandwichItem.findMany({
      where: { archived: false },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.sandwichFixOrder.findMany({
      where: { weekday, active: true },
      include: { customer: true, lines: true },
    }),
    prisma.sandwichOrder.findMany({
      where: { orderDate: parseDay(date) },
      include: { customer: true, lines: true },
    }),
  ]);

  const storeById = new Map<string, GridStore>();

  function ensure(customer: {
    id: string;
    storeName: string;
    storeGroup: StoreGroup;
    storeOrder: number;
  }): GridStore {
    const existing = storeById.get(customer.id);
    if (existing) return existing;
    const store: GridStore = {
      customerId: customer.id,
      storeName: customer.storeName,
      storeGroup: customer.storeGroup,
      storeOrder: customer.storeOrder,
      onFixList: false,
      saved: {},
      fix: {},
    };
    storeById.set(customer.id, store);
    return store;
  }

  for (const fixOrder of fixOrders) {
    const store = ensure(fixOrder.customer);
    store.onFixList = true;
    for (const line of fixOrder.lines) {
      if (line.quantity > 0) store.fix[line.itemId] = line.quantity;
    }
  }

  for (const order of orders) {
    const store = ensure(order.customer);
    for (const line of order.lines) {
      if (line.quantity > 0) store.saved[line.itemId] = line.quantity;
    }
  }

  const savedAt = orders.reduce<Date | null>(
    (latest, order) => (latest === null || order.updatedAt > latest ? order.updatedAt : latest),
    null
  );

  return {
    date,
    weekday,
    items: items.map((item) => ({
      itemId: item.id,
      name: item.name,
      shortLabel: excelLabelFor(item.name),
      order: item.order,
      price: item.price,
    })),
    stores: [...storeById.values()].sort(compareStoresForGrid),
    savedAt: savedAt?.toISOString() ?? null,
  };
}

export type DaySaveStoreInput = { customerId: string; items: SandwichOrderItemInput[] };

export type DaySaveResult = {
  date: string;
  savedAt: string;
  createdCount: number;
  /** Existing orders whose lines actually changed. A re-send of untouched data
   *  counts as unchanged, not updated. */
  updatedCount: number;
  unchangedCount: number;
  deletedCount: number;
  /** Stores whose stored lines actually differ from what was there before -
   *  drives the Telegram notification, which stays silent when a re-send
   *  changed nothing. */
  changedStoreNames: string[];
  /** The WHOLE day's totals after the write, not just the saved stores' - this
   *  is the number the owner reads back, so it has to cover every store. */
  totalQuantity: number;
  totalValueFt: number;
};

function sameLines(
  a: { itemId: string; quantity: number }[],
  b: { itemId: string; quantity: number }[]
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((line) => [line.itemId, line.quantity]));
  return b.every((line) => byId.get(line.itemId) === line.quantity);
}

/** Writes one weekday's orders for the listed stores only.
 *
 *  Deliberately a per-store upsert rather than a whole-day replace: the
 *  self-service ordering site writes the same SandwichOrder rows, so replacing
 *  the day would silently wipe an order placed minutes ago in a column the
 *  owner never touched. Stores absent from `stores` are left completely alone.
 *
 *  A store whose resulting line set is empty has its SandwichOrder DELETED, not
 *  stored with zero lines - an empty order would otherwise surface as a 0-total
 *  row in the summaries and an empty column on the kitchen printout. Clearing a
 *  column must look exactly like it was never entered. */
export async function saveSandwichDayGrid(
  date: string,
  stores: DaySaveStoreInput[]
): Promise<DaySaveResult> {
  const orderDate = parseDay(date);

  const catalogItems = await prisma.sandwichItem.findMany({ where: { archived: false } });
  const priceByItemId = new Map(catalogItems.map((item) => [item.id, item.price]));

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let deletedCount = 0;
  const changedStoreNames: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const store of stores) {
        // Reuses the public route's own line builder verbatim, so the
        // zero-dropping, archived-item-dropping and unitPriceFt snapshot rules
        // are identical on both write paths.
        const lines = buildSandwichOrderLines(store.items, priceByItemId);

        const existing = await tx.sandwichOrder.findUnique({
          where: { customerId_orderDate: { customerId: store.customerId, orderDate } },
          include: { lines: true, customer: { select: { storeName: true } } },
        });

        if (lines.length === 0) {
          if (existing) {
            await tx.sandwichOrder.delete({ where: { id: existing.id } });
            deletedCount++;
            changedStoreNames.push(existing.customer.storeName);
          }
          continue;
        }

        // A re-send of untouched data must be a no-op: no line churn, no
        // updatedAt bump, and nothing for the notification to report.
        if (existing && sameLines(existing.lines, lines)) {
          unchangedCount++;
          continue;
        }

        const order = existing
          ? existing
          : await tx.sandwichOrder.create({
              data: { customerId: store.customerId, orderDate },
              include: { lines: true, customer: { select: { storeName: true } } },
            });

        if (existing) updatedCount++;
        else createdCount++;

        await tx.sandwichOrderLine.deleteMany({ where: { orderId: order.id } });
        await tx.sandwichOrderLine.createMany({
          data: lines.map((line) => ({ orderId: order.id, ...line })),
        });
        changedStoreNames.push(order.customer.storeName);
      }
    },
    // ~3 statements per store over pgbouncer; Prisma's 5s interactive default
    // is not enough for a full day even though the UI only sends dirty stores.
    { timeout: 20_000, maxWait: 10_000 }
  );

  // Re-read the whole day rather than summing only what was just written: the
  // owner reads this number back to the caller, so it has to include the stores
  // that were never dirty (and any self-service order placed meanwhile).
  const dayOrders = await prisma.sandwichOrder.findMany({
    where: { orderDate },
    include: { lines: true },
  });
  let totalQuantity = 0;
  let totalValueFt = 0;
  for (const order of dayOrders) {
    for (const line of order.lines) {
      totalQuantity += line.quantity;
      totalValueFt += line.quantity * line.unitPriceFt;
    }
  }

  return {
    date,
    savedAt: new Date().toISOString(),
    createdCount,
    updatedCount,
    unchangedCount,
    deletedCount,
    changedStoreNames,
    totalQuantity,
    totalValueFt,
  };
}
