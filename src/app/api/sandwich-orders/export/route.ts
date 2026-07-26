import { NextResponse } from "next/server";
import { getSandwichExportDay } from "@/lib/sandwichDates";
import { getSandwichOrdersForDay } from "@/lib/sandwichOrdersSummary";
import { generateSandwichOrdersXlsx } from "@/lib/generateSandwichOrdersXlsx";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always tomorrow's orders (weekend-skipped to Monday) - no ?date param,
// since this is downloaded fresh throughout the day for that day's kitchen
// printout, same convention as the ready-meal export.
export const GET = withApiErrorHandling(async () => {
  const { date, dayName } = getSandwichExportDay(new Date());
  const rows = await getSandwichOrdersForDay(date);
  const buffer = await generateSandwichOrdersXlsx(date, dayName, rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="szendvics_${date}.xlsx"`,
    },
  });
});
