import { NextRequest, NextResponse } from "next/server";
import { getSummary } from "@/lib/summary";
import { todayStr } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? todayStr();
  const to = request.nextUrl.searchParams.get("to") ?? from;

  const summary = await getSummary(from, to);
  return NextResponse.json(summary);
}
