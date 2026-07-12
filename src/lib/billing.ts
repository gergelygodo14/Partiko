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
    const from = addDaysStr(toDayStr(last.to), 1);
    return {
      // A same-day close (last.to === today) would otherwise push `from` to
      // tomorrow, producing an inverted from>to range that makes every entry
      // dated today invisible/unrecordable until midnight - cap it so
      // today's entries (created after the close) stay recordable right away.
      from: from > to ? to : from,
      to,
      lastClosedAt: last.closedAt.toISOString(),
    };
  }

  const earliest = await prisma.entry.aggregate({ _min: { date: true } });
  const from = earliest._min.date ? toDayStr(earliest._min.date) : to;
  return { from, to, lastClosedAt: null };
}
