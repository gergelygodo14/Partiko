import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const GET = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/szamlak/invoices/[id]">
) => {
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(invoice);
});
