import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { suggestDish } from "@/lib/dishSuggestion";

export const maxDuration = 30;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const avoidDishes = body?.avoidDishes;
  const sameDayDishes = body?.sameDayDishes ?? [];

  if (!Array.isArray(avoidDishes) || !avoidDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "avoidDishes (string[]) kötelező" }, { status: 400 });
  }
  if (!Array.isArray(sameDayDishes) || !sameDayDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "sameDayDishes csak string[] lehet" }, { status: 400 });
  }

  const dish = await suggestDish(avoidDishes, sameDayDishes);
  return NextResponse.json({ dish });
});
