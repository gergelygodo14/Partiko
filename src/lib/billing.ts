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
