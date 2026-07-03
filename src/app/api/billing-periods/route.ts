import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenPeriod } from "@/lib/billing";
import { parseDay } from "@/lib/dates";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const periods = await prisma.billingPeriod.findMany({
    orderBy: { to: "desc" },
  });
  return NextResponse.json(periods);
});

export const POST = withApiErrorHandling(async () => {
  const { from, to } = await getOpenPeriod();
  const period = await prisma.billingPeriod.create({
    data: { from: parseDay(from), to: parseDay(to) },
  });
  return NextResponse.json(period, { status: 201 });
});
