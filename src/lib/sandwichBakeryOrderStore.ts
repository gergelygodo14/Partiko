// Split out from sandwichBakeryOrder.ts because that module is imported by a
// client component (OrderEntryScreen.tsx) for its pure functions - pulling
// prisma in there would drag server-only deps (pg, node:module) into the
// client bundle and break the build. Route handlers are always server-only,
// so they can import from here without that risk.
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/dates";
import type { BakeryOrderRow } from "@/lib/sandwichBakeryOrder";

// One record per day - sending a correction for the same date overwrites the
// previous one, since only the current standing order matters for the
// /rendelesfelvetel "van elég pékárunk" comparison, not a full history.
export async function saveBakeryOrder(dateStr: string, rows: BakeryOrderRow[]): Promise<void> {
  const date = parseDay(dateStr);
  await prisma.sandwichBakeryOrder.upsert({
    where: { date },
    create: { date, rows },
    update: { rows, sentAt: new Date() },
  });
}

export async function getBakeryOrderForDate(dateStr: string): Promise<BakeryOrderRow[] | null> {
  const record = await prisma.sandwichBakeryOrder.findUnique({ where: { date: parseDay(dateStr) } });
  return record ? (record.rows as unknown as BakeryOrderRow[]) : null;
}
