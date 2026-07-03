import { NextResponse } from "next/server";
import { getOpenPeriod } from "@/lib/billing";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const period = await getOpenPeriod();
  return NextResponse.json(period);
});
