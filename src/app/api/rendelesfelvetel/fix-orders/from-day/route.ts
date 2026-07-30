import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { copyDayIntoFixOrders } from "@/lib/sandwichFixOrders";
import { isValidDateStr } from "@/lib/validate";
import { weekdayIndexOf } from "@/lib/weekdays";

// "Make what is on the grid the fix order for this weekday."
//
// Reads the STORED orders for that date, not the client's draft - the owner has
// to send first, so a template can never capture a half-typed column.
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { date, customerIds } = body as { date?: unknown; customerIds?: unknown };

  if (typeof date !== "string" || !isValidDateStr(date)) {
    return NextResponse.json({ error: "Érvényes date kötelező" }, { status: 400 });
  }
  const weekday = weekdayIndexOf(date);
  if (weekday === null) {
    return NextResponse.json({ error: "Csak hétfő-péntek adható meg" }, { status: 400 });
  }
  if (
    customerIds !== undefined &&
    (!Array.isArray(customerIds) || customerIds.some((id) => typeof id !== "string"))
  ) {
    return NextResponse.json({ error: "customerIds csak string tömb lehet" }, { status: 400 });
  }

  return NextResponse.json(
    await copyDayIntoFixOrders(date, weekday, customerIds as string[] | undefined)
  );
});
