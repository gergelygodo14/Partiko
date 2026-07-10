import { NextResponse } from "next/server";
import { getPriceComparison } from "@/lib/priceComparison";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async () => {
  const rows = await getPriceComparison();
  return NextResponse.json(rows);
});
