import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { isValidDateStr } from "@/lib/validate";
import { suggestDishes } from "@/lib/dishSuggestion";

// Retested (2026-08-13) with the actual payload shape a real click sends -
// not just an empty avoidDishes/weekDishes, which had made the call look
// much faster than it really is: with real "avoid these ~9 dishes,
// thematically too" content for the model to weigh against all 60
// candidates, responses ranged 13.6s-26.9s across 6 real requests. The
// previous 60s ceiling (with a 25s-per-attempt timeout in dishSuggestion.ts)
// meant a single legitimate ~27s response could get aborted by our OWN
// timeout before it finished - see the timeoutMs comment there.
export const maxDuration = 90;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const weekStart = body?.weekStart;
  const avoidDishes = body?.avoidDishes;
  const sameDayDishes = body?.sameDayDishes ?? [];
  const weekDishes = body?.weekDishes ?? [];

  if (!isValidDateStr(weekStart)) {
    return NextResponse.json({ error: "weekStart (érvényes dátum) kötelező" }, { status: 400 });
  }
  if (!Array.isArray(avoidDishes) || !avoidDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "avoidDishes (string[]) kötelező" }, { status: 400 });
  }
  if (!Array.isArray(sameDayDishes) || !sameDayDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "sameDayDishes csak string[] lehet" }, { status: 400 });
  }
  if (!Array.isArray(weekDishes) || !weekDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "weekDishes csak string[] lehet" }, { status: 400 });
  }

  const dishes = await suggestDishes({ weekStart, avoidDishes, sameDayDishes, weekDishes });
  return NextResponse.json({ dishes });
});
