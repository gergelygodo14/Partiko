import { NextResponse } from "next/server";
import { budapestTodayStr, mondayOf } from "@/lib/dates";
import { getSandwichWeekSummary } from "@/lib/sandwichOrdersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";

// Always the calendar week (Mon-Fri) containing today - unlike the
// ready-meal weekly summary, sandwich ordering has no "next week" concept
// to switch into ahead of time (the order target is only ever 1-2 days
// out), so there's no cutoff-driven week to pick here.
export const GET = withApiErrorHandling(async () => {
  const weekStart = mondayOf(budapestTodayStr(new Date()));
  const summary = await getSandwichWeekSummary(weekStart);
  return NextResponse.json(summary);
});
