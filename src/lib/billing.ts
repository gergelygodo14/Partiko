import { prisma } from "@/lib/db";
import { addDaysStr, toDayStr, todayStr } from "@/lib/dates";

export async function getOpenPeriod(): Promise<{
  from: string;
  to: string;
  lastClosedAt: string | null;
}> {
  const to = todayStr();
  const last = await prisma.billingPeriod.findFirst({ orderBy: { to: "desc" } });

  if (last) {
    // Deliberately NOT capped at `to`: this range feeds the Összesítő "Nyitott
    // időszak" billing summary, which must never re-include a day that's
    // already inside a closed BillingPeriod. If the period was closed today
    // (last.to === today), `from` (tomorrow) ends up after `to` (today) on
    // purpose - rangeBetween() then yields an empty (not inverted-but-buggy)
    // query, correctly showing nothing open yet until tomorrow. Consumers
    // that need today's just-created entries regardless (the Rögzítés page)
    // must widen this range themselves rather than have it capped here.
    return {
      from: addDaysStr(toDayStr(last.to), 1),
      to,
      lastClosedAt: last.closedAt.toISOString(),
    };
  }

  const earliest = await prisma.entry.aggregate({ _min: { date: true } });
  const from = earliest._min.date ? toDayStr(earliest._min.date) : to;
  return { from, to, lastClosedAt: null };
}
