import { NextResponse } from "next/server";
import { getSandwichExportDay } from "@/lib/sandwichDates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import { generateSandwichDailySummaryXlsx } from "@/lib/generateSandwichDailySummaryXlsx";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always tomorrow's totals (weekend-skipped to Monday), same convention as
// the store-by-store kitchen export.
export const GET = withApiErrorHandling(async () => {
  const { date, dayName } = getSandwichExportDay(new Date());
  const items = await getSandwichItemTotalsForDay(date);
  const buffer = await generateSandwichDailySummaryXlsx(date, dayName, items);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="szendvics_osszesites_${date}.xlsx"`,
    },
  });
});
