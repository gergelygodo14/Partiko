import { NextResponse } from "next/server";
import { getExportDay } from "@/lib/dates";
import { getOrdersForDay } from "@/lib/ordersSummary";
import { generateOrdersXlsx } from "@/lib/generateOrdersXlsx";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always the next calendar day's orders (the kitchen preps each weekday's
// food the day before - see getExportDay) - no ?week/?date param, since this
// is downloaded fresh every morning for that day's kitchen printout.
export const GET = withApiErrorHandling(async () => {
  const { date, weekStart, dayIndex } = getExportDay(new Date());

  const { totals, byCustomer } =
    dayIndex === null ? { totals: { a: 0, b: 0, c: 0 }, byCustomer: [] } : await getOrdersForDay(weekStart, dayIndex);

  const buffer = await generateOrdersXlsx(date, totals, byCustomer);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rendelesek_${date}.xlsx"`,
    },
  });
});
