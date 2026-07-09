import { NextResponse } from "next/server";
import { getKitchenExportDay } from "@/lib/dates";
import { DAY_NAMES } from "@/lib/weeklyMenu";
import { emptyOrderWeek } from "@/lib/orders";
import { getDishNamesForDay, getOrdersForDay } from "@/lib/ordersSummary";
import { generateOrdersXlsx } from "@/lib/generateOrdersXlsx";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Normally the next calendar day's orders (the kitchen preps each weekday's
// food the day before); from Thursday 16:00 onward it jumps to next Monday
// instead - see getKitchenExportDay. No ?week/?date param, since this is
// downloaded fresh throughout the day for that day's kitchen printout.
export const GET = withApiErrorHandling(async () => {
  const { date, weekStart, dayIndex } = getKitchenExportDay(new Date());
  const dayName = dayIndex !== null ? DAY_NAMES[dayIndex] : "";

  const [dishNames, dayResult] = await Promise.all([
    getDishNamesForDay(weekStart, dayIndex),
    dayIndex === null
      ? Promise.resolve({ totals: emptyOrderWeek()[0], byCustomer: [] })
      : getOrdersForDay(weekStart, dayIndex),
  ]);

  const buffer = await generateOrdersXlsx(date, dayName, dishNames, dayResult.totals, dayResult.byCustomer);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rendelesek_${date}.xlsx"`,
    },
  });
});
