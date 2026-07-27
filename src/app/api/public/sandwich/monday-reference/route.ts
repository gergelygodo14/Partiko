import { NextRequest, NextResponse } from "next/server";
import { MONDAY_REFERENCE_ORDERS } from "@/lib/mondayReferenceOrders";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

// Whole table in one response, same fetch-once-filter-client-side convention
// as /api/public/customers (the store count is small enough that this is
// simpler and cheaper than a lookup-by-name endpoint).
export const GET = withCors(
  withApiErrorHandling(async () => {
    return NextResponse.json(MONDAY_REFERENCE_ORDERS);
  })
);
