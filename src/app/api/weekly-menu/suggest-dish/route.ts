import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { suggestDish } from "@/lib/dishSuggestion";

export const maxDuration = 30;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const avoidDishes = body?.avoidDishes;

  if (!Array.isArray(avoidDishes) || !avoidDishes.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "avoidDishes (string[]) kötelező" }, { status: 400 });
  }

  const dish = await suggestDish(avoidDishes);
  return NextResponse.json({ dish });
});
