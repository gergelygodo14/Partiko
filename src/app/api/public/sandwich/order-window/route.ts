import { NextRequest, NextResponse } from "next/server";
import { getSandwichOrderTargetDay } from "@/lib/sandwichDates";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    void request;
    const target = getSandwichOrderTargetDay();
    return NextResponse.json({ orderDate: target.date, dayName: target.dayName });
  })
);
