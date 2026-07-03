import { NextRequest, NextResponse } from "next/server";
import { getSummary } from "@/lib/summary";
import { todayStr } from "@/lib/dates";
import { isValidDateStr } from "@/lib/validate";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const from = request.nextUrl.searchParams.get("from") ?? todayStr();
  const to = request.nextUrl.searchParams.get("to") ?? from;

  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json(
      { error: "Érvénytelen from/to dátum" },
      { status: 400 }
    );
  }

  const summary = await getSummary(from, to);
  return NextResponse.json(summary);
});
