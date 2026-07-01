import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]">
) {
  const { id } = await ctx.params;
  await prisma.entry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
