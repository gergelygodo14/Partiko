import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { getBakeryOrderForDate } from "@/lib/sandwichBakeryOrderStore";
import { isValidDateStr } from "@/lib/validate";

// Staff-only lookup of what was actually sent to the bakery for a given day
// (see SandwichBakeryOrder) - lets /rendelesfelvetel show that figure next to
// the day's live sandwich-order totals. Same access-control story as
// api/rendelesfelvetel/day: outside PUBLIC_API_PREFIXES, so proxy.ts already
// puts it behind the session cookie.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !isValidDateStr(date)) {
    return NextResponse.json({ error: "Érvényes date paraméter kötelező" }, { status: 400 });
  }

  const rows = await getBakeryOrderForDate(date);
  return NextResponse.json({ date, rows });
});
