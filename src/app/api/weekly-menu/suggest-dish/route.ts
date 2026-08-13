import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { isValidDateStr } from "@/lib/validate";
import { suggestDishes } from "@/lib/dishSuggestion";

// Matches szamlak/invoices' AI route - a single non-streaming Sonnet call
// through OpenRouter measured at ~17s for a realistic prompt (60 candidates
// + variety instructions), so 30s left little margin for provider slowness.
export const maxDuration = 60;

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
