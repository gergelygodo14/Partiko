import { NextResponse } from "next/server";
import { getSandwichExportDay } from "@/lib/sandwichDates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import { computeMeatPrep } from "@/lib/sandwichMeatPrep";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always tomorrow's prep totals (weekend-skipped to Monday) - independent
// of the week/month view toggle on the admin summary, since this answers
// "how much meat to cook tonight", not "how much this period".
export const GET = withApiErrorHandling(async () => {
  const { date, dayName } = getSandwichExportDay(new Date());
  const items = await getSandwichItemTotalsForDay(date);
  const meatPrep = computeMeatPrep(items);
  return NextResponse.json({ date, dayName, ...meatPrep });
});
