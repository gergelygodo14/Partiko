import { NextResponse } from "next/server";
import { getOpenPeriod } from "@/lib/billing";

export async function GET() {
  const period = await getOpenPeriod();
  return NextResponse.json(period);
}
