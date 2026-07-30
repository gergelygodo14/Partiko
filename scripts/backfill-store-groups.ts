// One-off backfill for Customer.storeGroup, introduced by the
// add_sandwich_fix_orders_and_store_groups migration.
//
// Before that column existed, the delivery-round grouping lived in two
// hardcoded places: isVidekStore() (5 literal names) in the .xlsx export's
// vidék filter, and groupFavAndCoopAdjacent()'s own /^fav\b/i and /^coop\b/i
// regexes. This script writes the same classification into the column so the
// printed export keeps producing byte-identical output once it switches to
// reading storeGroup instead of re-deriving it from names.
//
// Does NOT touch storeOrder - that is seeded from the reference workbook's
// column order by import-fix-orders.ts.
//
//   npx tsx scripts/backfill-store-groups.ts            # dry run (default)
//   npx tsx scripts/backfill-store-groups.ts --apply    # writes
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type StoreGroup } from "../src/generated/prisma/client";
import { OVERRIDDEN_STORE_NAMES, suggestStoreGroup } from "../src/lib/sandwichStoreGroups";
import { isVidekStore } from "../src/lib/sandwichVidekStores";

// The pre-column rules, inlined verbatim as a reference implementation. The
// unit test proves suggestStoreGroup matches this for the 33 store names the
// repo knows about; this runtime check extends that proof to every name
// actually in the database, including ready-meal-only customers that never
// appear in mondayReferenceOrders.ts.
function legacyGroupOf(storeName: string): StoreGroup {
  if (isVidekStore(storeName)) return "VIDEK";
  const name = storeName.trim();
  if (/^fav\b/i.test(name)) return "FAV";
  if (/^coop\b/i.test(name)) return "COOP";
  return "EGYEB";
}

async function main() {
  const apply = process.argv.includes("--apply");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const customers = await prisma.customer.findMany({
      select: { id: true, storeName: true, storeGroup: true },
      orderBy: { storeName: "asc" },
    });

    const rows = customers.map((customer) => {
      const target = suggestStoreGroup(customer.storeName);
      return {
        ...customer,
        target,
        legacy: legacyGroupOf(customer.storeName),
        changes: customer.storeGroup !== target,
      };
    });

    // Explicit owner overrides are *expected* to diverge from the old
    // name-pattern logic - that is the whole point of them. Everything else
    // diverging means suggestStoreGroup() drifted and the printout would
    // silently change, so the write is refused.
    const overridden = new Set(OVERRIDDEN_STORE_NAMES);
    const disagreements = rows.filter(
      (row) => row.target !== row.legacy && !overridden.has(row.storeName.trim().toLowerCase())
    );
    if (disagreements.length > 0) {
      console.error(
        `\n✗ suggestStoreGroup() nem egyezik a régi hardkódolt logikával ${disagreements.length} boltnál:`
      );
      for (const row of disagreements) {
        console.error(`   ${row.storeName}: új=${row.target} régi=${row.legacy}`);
      }
      console.error("\nÍrás megtagadva - ezt előbb tisztázni kell.");
      process.exitCode = 1;
      return;
    }

    const intentional = rows.filter(
      (row) => row.target !== row.legacy && overridden.has(row.storeName.trim().toLowerCase())
    );
    if (intentional.length > 0) {
      console.log("\nSzándékos felülbírálás (tulajdonosi döntés, nem a névből következik):");
      for (const row of intentional) {
        console.log(`   ${row.storeName}: ${row.legacy} → ${row.target}`);
      }
    }

    const byGroup = new Map<StoreGroup, string[]>();
    for (const row of rows) {
      if (!byGroup.has(row.target)) byGroup.set(row.target, []);
      byGroup.get(row.target)!.push(row.storeName);
    }

    console.log(`\n${customers.length} bolt, csoportonként:\n`);
    for (const group of ["FAV", "COOP", "VIDEK", "EGYEB"] as StoreGroup[]) {
      const names = byGroup.get(group) ?? [];
      console.log(`  ${group.padEnd(6)} (${String(names.length).padStart(3)}): ${names.join(", ")}`);
    }

    const toChange = rows.filter((row) => row.changes);
    console.log(`\nMódosítandó: ${toChange.length} / ${customers.length}`);
    for (const row of toChange) {
      console.log(`  ${row.storeName}: ${row.storeGroup} → ${row.target}`);
    }

    if (!apply) {
      console.log("\n(dry run - semmi nem íródott. --apply kell az íráshoz.)\n");
      return;
    }

    if (toChange.length === 0) {
      console.log("\nNincs mit írni.\n");
      return;
    }

    // Grouped into one updateMany per target group rather than one update per
    // customer: a few statements instead of a few dozen over pgbouncer.
    await prisma.$transaction(
      [...byGroup.entries()].map(([group, names]) =>
        prisma.customer.updateMany({
          where: { id: { in: rows.filter((r) => names.includes(r.storeName)).map((r) => r.id) } },
          data: { storeGroup: group },
        })
      )
    );

    console.log(`\n✓ ${toChange.length} bolt storeGroup-ja frissítve.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
