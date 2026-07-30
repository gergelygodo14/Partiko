// Loads scripts/fix-orders.extracted.json into SandwichFixOrder /
// SandwichFixOrderLine, and sets Customer.storeGroup + Customer.storeOrder for
// the stores it covers.
//
//   npx tsx scripts/import-fix-orders.ts            # dry run (default)
//   npx tsx scripts/import-fix-orders.ts --apply    # writes
//   npx tsx scripts/import-fix-orders.ts --apply --force   # ignore the re-run guard
//
// ⚠ Local dev and production share one live Supabase database. --apply writes
// real data. Everything it writes is invisible to the currently deployed code
// (nothing reads storeGroup/storeOrder/SandwichFixOrder yet) EXCEPT the three
// newly created customers, which show up in the ordering sites' store-name
// typeahead - the owner approved that on 2026-07-30.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { NEW_STORE_NAMES } from "../src/lib/sandwichFixOrderSource";
import { suggestStoreGroup } from "../src/lib/sandwichStoreGroups";

const INPUT_PATH = path.join(__dirname, "fix-orders.extracted.json");
const BACKUP_PATH = path.join(
  __dirname,
  "..",
  `fix-orders-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);

type ExtractedLine = { excelLabel: string; itemName: string; quantity: number };
type ExtractedStore = {
  rawName: string;
  storeName: string;
  storeOrder: number;
  computedTotal: number;
  lines: ExtractedLine[];
};
type Extracted = {
  newStores: string[];
  weekdays: { weekday: number; stores: ExtractedStore[] }[];
};

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  const extracted = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8")) as Extracted;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // --- Re-run guard -------------------------------------------------------
    // Once the owner has edited a template in the UI, updatedAt moves past
    // createdAt. Blindly re-running would silently revert those corrections.
    const editedCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "SandwichFixOrder" WHERE "updatedAt" > "createdAt"
    `;
    const edited = Number(editedCount[0]?.count ?? 0);
    if (edited > 0 && !force) {
      console.error(
        `\n✗ ${edited} fix rendelést már szerkesztettek a felületen.\n` +
          `  Az újrafuttatás felülírná ezeket. --force kell, ha tényleg ezt akarod.\n`
      );
      process.exitCode = 1;
      return;
    }

    // --- Resolve the catalog -----------------------------------------------
    const items = await prisma.sandwichItem.findMany({ select: { id: true, name: true } });
    const itemIdByName = new Map(items.map((item) => [item.name, item.id]));

    const neededItemNames = new Set(
      extracted.weekdays.flatMap((w) => w.stores.flatMap((s) => s.lines.map((l) => l.itemName)))
    );
    const missingItems = [...neededItemNames].filter((name) => !itemIdByName.has(name));
    if (missingItems.length > 0) {
      console.error(
        `\n✗ ${missingItems.length} tétel nincs meg a SandwichItem katalógusban:\n` +
          missingItems.map((n) => `   ${n}`).join("\n") +
          `\n  (Átnevezték a katalógusban? A script szándékosan nem talál ki tételt.)\n`
      );
      process.exitCode = 1;
      return;
    }

    // --- Resolve the stores -------------------------------------------------
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        storeName: true,
        storeGroup: true,
        storeOrder: true,
        createdAt: true,
        _count: { select: { sandwichOrders: true } },
      },
    });

    const byLowerName = new Map<string, typeof customers>();
    for (const customer of customers) {
      const key = customer.storeName.trim().toLowerCase();
      if (!byLowerName.has(key)) byLowerName.set(key, []);
      byLowerName.get(key)!.push(customer);
    }

    // storeOrder is a single value per customer, but the workbook gives a
    // position per weekday. Take the earliest weekday the store appears on
    // (Monday's 33-store tab covers almost everyone) so the grid's column order
    // matches the sheet the owner reads most.
    const storeOrderByName = new Map<string, number>();
    const allStoreNames: string[] = [];
    for (const weekday of extracted.weekdays) {
      for (const store of weekday.stores) {
        if (!storeOrderByName.has(store.storeName)) {
          storeOrderByName.set(store.storeName, store.storeOrder);
          allStoreNames.push(store.storeName);
        }
      }
    }

    const resolved = new Map<string, { id: string; created: boolean }>();
    const toCreate: string[] = [];
    const ambiguous: string[] = [];

    for (const storeName of allStoreNames) {
      const matches = byLowerName.get(storeName.trim().toLowerCase()) ?? [];
      if (matches.length === 0) {
        if (!NEW_STORE_NAMES.includes(storeName)) {
          console.error(`\n✗ "${storeName}" nincs az ügyfelek között, és nem is új boltként várt.`);
          process.exitCode = 1;
          return;
        }
        toCreate.push(storeName);
        continue;
      }
      // Duplicate customers exist under identical names (e.g. two "Mars taxi"
      // rows, both with real orders). Owner's decision, 2026-07-30: attach the
      // fix order to whichever has more actual sandwich orders; oldest wins ties.
      const chosen = [...matches].sort(
        (a, b) =>
          b._count.sandwichOrders - a._count.sandwichOrders ||
          a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      if (matches.length > 1) {
        ambiguous.push(
          `${storeName}: ${matches.length} ügyfél, választva a ${chosen._count.sandwichOrders} rendeléses (${chosen.id})`
        );
      }
      resolved.set(storeName, { id: chosen.id, created: false });
    }

    // --- Report -------------------------------------------------------------
    console.log(`\n${allStoreNames.length} bolt, ${extracted.weekdays.length} munkanap\n`);
    for (const weekday of extracted.weekdays) {
      const total = weekday.stores.reduce((sum, s) => sum + s.computedTotal, 0);
      const empty = weekday.stores.filter((s) => s.lines.length === 0).length;
      console.log(
        `  weekday=${weekday.weekday}: ${String(weekday.stores.length).padStart(2)} fix rendelés, ` +
          `${String(total).padStart(4)} db, ${empty} üres (bolt a körön, mennyiség nélkül)`
      );
    }

    if (toCreate.length > 0) {
      console.log(`\n  ÚJ ügyfelek létrehozása (${toCreate.length}):`);
      for (const name of toCreate) {
        console.log(`    ${name}  →  storeGroup=${suggestStoreGroup(name)}`);
      }
      console.log("    ⚠ Ezek megjelennek az ügyfél-rendelő oldalak boltnév-kiegészítőjében is.");
    }

    if (ambiguous.length > 0) {
      console.log(`\n  Több egyező ügyfél (${ambiguous.length}):`);
      for (const note of ambiguous) console.log(`    ${note}`);
    }

    const groupChanges = [...resolved.entries()].filter(([storeName]) => {
      const customer = customers.find((c) => c.id === resolved.get(storeName)!.id)!;
      return (
        customer.storeGroup !== suggestStoreGroup(storeName) ||
        customer.storeOrder !== storeOrderByName.get(storeName)
      );
    });
    console.log(`\n  storeGroup/storeOrder frissítés: ${groupChanges.length} bolt`);

    if (!apply) {
      console.log("\n(dry run - semmi nem íródott. --apply kell az íráshoz.)\n");
      return;
    }

    // --- Backup -------------------------------------------------------------
    const existing = await prisma.sandwichFixOrder.findMany({
      include: { lines: true, customer: { select: { storeName: true } } },
    });
    fs.writeFileSync(
      BACKUP_PATH,
      `${JSON.stringify(
        {
          savedAt: new Date().toISOString(),
          customers: customers.map((c) => ({
            id: c.id,
            storeName: c.storeName,
            storeGroup: c.storeGroup,
            storeOrder: c.storeOrder,
          })),
          fixOrders: existing,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`\n  Mentés a módosítás előtt: ${path.relative(process.cwd(), BACKUP_PATH)}`);

    // --- Create missing customers ------------------------------------------
    for (const storeName of toCreate) {
      const created = await prisma.customer.create({
        data: {
          storeName,
          companyName: "",
          storeGroup: suggestStoreGroup(storeName),
          storeOrder: storeOrderByName.get(storeName) ?? 0,
        },
        select: { id: true },
      });
      resolved.set(storeName, { id: created.id, created: true });
      console.log(`  + új ügyfél: ${storeName}`);
    }

    // --- Write the templates, one transaction per weekday --------------------
    let written = 0;
    for (const weekday of extracted.weekdays) {
      await prisma.$transaction(
        async (tx) => {
          for (const store of weekday.stores) {
            const customerId = resolved.get(store.storeName)!.id;

            await tx.customer.update({
              where: { id: customerId },
              data: {
                storeGroup: suggestStoreGroup(store.storeName),
                storeOrder: storeOrderByName.get(store.storeName) ?? 0,
              },
            });

            const fixOrder = await tx.sandwichFixOrder.upsert({
              where: { customerId_weekday: { customerId, weekday: weekday.weekday } },
              update: { active: true },
              create: { customerId, weekday: weekday.weekday, active: true },
              select: { id: true },
            });

            // Replace rather than merge: the workbook is the authority on this
            // first import, and a zero-line template is meaningful (store is on
            // the round, no standing quantities).
            await tx.sandwichFixOrderLine.deleteMany({ where: { fixOrderId: fixOrder.id } });
            if (store.lines.length > 0) {
              await tx.sandwichFixOrderLine.createMany({
                data: store.lines.map((line) => ({
                  fixOrderId: fixOrder.id,
                  itemId: itemIdByName.get(line.itemName)!,
                  quantity: line.quantity,
                })),
              });
            }
            written++;
          }
        },
        // A weekday is ~33 stores x 3 statements over pgbouncer; Prisma's 5s
        // interactive-transaction default is not enough.
        { timeout: 60_000, maxWait: 15_000 }
      );
      console.log(`  ✓ weekday=${weekday.weekday}: ${weekday.stores.length} fix rendelés`);
    }

    console.log(`\n✓ ${written} fix rendelés írva.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
