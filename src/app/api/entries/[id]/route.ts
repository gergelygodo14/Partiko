import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";

export const DELETE = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]">
) => {
  const { id } = await ctx.params;
  await prisma.entry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
