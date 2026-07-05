import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async (
    _request: NextRequest,
    ctx: RouteContext<"/api/public/customers/[id]">
  ) => {
    const { id } = await ctx.params;
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });

    return NextResponse.json({
      customerId: customer.id,
      storeName: customer.storeName,
      companyName: customer.companyName,
    });
  })
);
