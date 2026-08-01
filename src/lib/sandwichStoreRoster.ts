import type { StoreGroup } from "@/generated/prisma/client";
import { parseDay } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { WEEKDAY_COUNT } from "@/lib/weekdays";

// Which stores appear as columns on a given day is decided by getSandwichDayGrid:
// a store is on the day if it has an active SandwichFixOrder for that weekday,
// OR it already has a SandwichOrder on that date. This module is the write side
// of the first half - the roster the owner edits by hand.
//
// Note that roster membership is invisible outside this screen: the kitchen
// export and every summary read SandwichOrder rows, so a store parked on a round
// with no order changes nothing they print or count. Adding a store is therefore
// a cheap, reversible act; removing one is where the care is needed.

export const ALL_WEEKDAYS = Array.from({ length: WEEKDAY_COUNT }, (_, i) => i);

/** Puts a store on the given weekdays' rounds, leaving its stored fix quantities
 *  alone.
 *
 *  Deliberately NOT saveFixOrdersForWeekday() with an empty items array: that
 *  one rewrites the template lines, so re-adding a store that is already on the
 *  round would silently wipe the very template it is there for. */
export async function addStoreToRounds(customerId: string, weekdays: number[]): Promise<number[]> {
  const targets = [...new Set(weekdays)].filter(
    (weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday < WEEKDAY_COUNT
  );
  if (targets.length === 0) return [];

  await prisma.$transaction(
    targets.map((weekday) =>
      prisma.sandwichFixOrder.upsert({
        where: { customerId_weekday: { customerId, weekday } },
        update: { active: true },
        create: { customerId, weekday, active: true },
        select: { id: true },
      })
    )
  );

  return targets.sort((a, b) => a - b);
}

export type StoreRemovalInfo = {
  customerId: string;
  storeName: string;
  storeGroup: StoreGroup;
  /** Weekdays (0=Mon..4=Fri) the store is currently on the round for. */
  roundWeekdays: number[];
  /** What is stored for the date being edited. Removing the column has to take
   *  this with it, otherwise the store reappears immediately (it has an order)
   *  and the removal looks like it did nothing. */
  quantityOnDate: number;
  hasOrderOnDate: boolean;
  sandwichOrderCount: number;
  readyMealOrderCount: number;
  /** A customer with no order of either kind is a mistake to undo - a typo, a
   *  duplicate - and can go entirely. Anything else is history that the
   *  summaries, the monthly billing view and the printouts still read, so the
   *  customer row stays and only the roster membership is removed. */
  deletable: boolean;
};

export async function getStoreRemovalInfo(
  customerId: string,
  date: string | null
): Promise<StoreRemovalInfo | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, storeName: true, storeGroup: true },
  });
  if (!customer) return null;

  const [fixOrders, sandwichOrderCount, readyMealOrderCount, orderOnDate] = await Promise.all([
    prisma.sandwichFixOrder.findMany({
      where: { customerId, active: true },
      select: { weekday: true },
    }),
    prisma.sandwichOrder.count({ where: { customerId } }),
    prisma.order.count({ where: { customerId } }),
    date === null
      ? Promise.resolve(null)
      : prisma.sandwichOrder.findUnique({
          where: { customerId_orderDate: { customerId, orderDate: parseDay(date) } },
          include: { lines: { select: { quantity: true } } },
        }),
  ]);

  return {
    customerId: customer.id,
    storeName: customer.storeName,
    storeGroup: customer.storeGroup,
    roundWeekdays: fixOrders.map((fixOrder) => fixOrder.weekday).sort((a, b) => a - b),
    quantityOnDate: (orderOnDate?.lines ?? []).reduce((sum, line) => sum + line.quantity, 0),
    hasOrderOnDate: orderOnDate !== null,
    sandwichOrderCount,
    readyMealOrderCount,
    deletable: sandwichOrderCount === 0 && readyMealOrderCount === 0,
  };
}

/** Takes a store off the listed weekdays' rounds.
 *
 *  `date` is the day the owner is looking at: its order is deleted too, because
 *  otherwise the column stays on screen (getSandwichDayGrid includes any store
 *  with an order) and the removal appears to have failed. Orders on OTHER dates
 *  are never touched - those are real, already-delivered history, and a store
 *  removed from Wednesdays legitimately reappears next Wednesday if someone
 *  entered an order for it. */
export async function removeStoreFromRounds(
  customerId: string,
  weekdays: number[],
  date: string | null
): Promise<{ removedWeekdays: number[]; deletedOrder: boolean }> {
  const targets = [...new Set(weekdays)].filter(
    (weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday < WEEKDAY_COUNT
  );

  const deleted = await prisma.$transaction(async (tx) => {
    if (targets.length > 0) {
      await tx.sandwichFixOrder.deleteMany({ where: { customerId, weekday: { in: targets } } });
    }
    if (date === null) return false;
    // deleteMany rather than delete: no order on that date is the normal case,
    // not a 404.
    const removed = await tx.sandwichOrder.deleteMany({
      where: { customerId, orderDate: parseDay(date) },
    });
    return removed.count > 0;
  });

  return { removedWeekdays: targets.sort((a, b) => a - b), deletedOrder: deleted };
}

/** Deletes the Customer row itself. Only ever succeeds for a store with no
 *  orders at all - the typo/duplicate case.
 *
 *  The count is re-checked inside the transaction rather than trusted from the
 *  dialog that opened seconds earlier: the self-service sandwich site writes
 *  SandwichOrder rows for the same customers at any time. Even if that check
 *  lost the race, the Order/SandwichOrder foreign keys have no cascade, so the
 *  database itself would refuse - this only turns that into a readable error. */
export async function deleteStoreCompletely(
  customerId: string
): Promise<{ deleted: boolean; reason?: string }> {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) return { deleted: false, reason: "Ez a bolt már nem létezik." };

    const [sandwichOrderCount, readyMealOrderCount] = await Promise.all([
      tx.sandwichOrder.count({ where: { customerId } }),
      tx.order.count({ where: { customerId } }),
    ]);
    if (sandwichOrderCount > 0 || readyMealOrderCount > 0) {
      return {
        deleted: false,
        reason: `Ennek a boltnak ${sandwichOrderCount + readyMealOrderCount} korábbi rendelése van, ezért nem törölhető. Vedd le a napi listákról helyette.`,
      };
    }

    // Fix-order lines cascade off SandwichFixOrder; the fix orders themselves do
    // not cascade off Customer, so they go first.
    await tx.sandwichFixOrder.deleteMany({ where: { customerId } });
    await tx.customer.delete({ where: { id: customerId } });
    return { deleted: true };
  });
}
