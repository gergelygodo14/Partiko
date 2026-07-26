import { NextRequest, NextResponse } from "next/server";
import { getSandwichCustomerHistory } from "@/lib/sandwichOrdersSummary";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

const HISTORY_LIMIT = 5;

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

// A customer's last few distinct order dates, so the ordering page can
// offer "same as last time" prefill chips.
export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const customerId = request.nextUrl.searchParams.get("customerId");
    if (!customerId) {
      return NextResponse.json({ error: "customerId kötelező" }, { status: 400 });
    }
    const history = await getSandwichCustomerHistory(customerId, HISTORY_LIMIT);
    return NextResponse.json({ history });
  })
);
