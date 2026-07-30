import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { isValidDateStr } from "@/lib/validate";
import { suggestDish } from "@/lib/dishSuggestion";

export const maxDuration = 30;

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

  const dish = await suggestDish({ weekStart, avoidDishes, sameDayDishes, weekDishes });
  return NextResponse.json({ dish });
});
