import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { getSandwichCustomerHistory } from "@/lib/sandwichOrdersSummary";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

// Thin wrapper over the existing getSandwichCustomerHistory - the same query
// the customer-facing ordering site uses for its "same as last time" chips.
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const customerId = request.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId kötelező" }, { status: 400 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return NextResponse.json({ history: await getSandwichCustomerHistory(customerId, limit) });
});
