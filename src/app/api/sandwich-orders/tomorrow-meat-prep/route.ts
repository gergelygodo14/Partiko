import { NextResponse } from "next/server";
import { getSandwichExportDay, toTargetDay } from "@/lib/sandwichDates";
import { addDaysStr } from "@/lib/dates";
import { getSandwichItemTotalsForDay } from "@/lib/sandwichOrdersSummary";
import { computeMeatPrep } from "@/lib/sandwichMeatPrep";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always tomorrow's prep totals (weekend-skipped to Monday) - independent
// of the week/month view toggle on the admin summary, since this answers
// "how much meat to cook tonight", not "how much this period". Alongside it,
// the same weekday one week earlier - a reference point for how much was
// actually needed last time, requested for comparing week over week.
export const GET = withApiErrorHandling(async () => {
  const { date, dayName } = getSandwichExportDay(new Date());
  const items = await getSandwichItemTotalsForDay(date);
  const meatPrep = computeMeatPrep(items);

  const previousWeekDate = addDaysStr(date, -7);
  const previousWeekItems = await getSandwichItemTotalsForDay(previousWeekDate);
  const previousWeekMeatPrep = computeMeatPrep(previousWeekItems);

  return NextResponse.json({
    date,
    dayName,
    ...meatPrep,
    previousWeek: { ...toTargetDay(previousWeekDate), ...previousWeekMeatPrep },
  });
});
