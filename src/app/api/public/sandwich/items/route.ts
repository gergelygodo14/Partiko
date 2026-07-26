import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "GET, OPTIONS");

export const GET = withCors(
  withApiErrorHandling(async () => {
    const items = await prisma.sandwichItem.findMany({
      where: { archived: false },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(
      items.map((item) => ({ itemId: item.id, name: item.name, price: item.price }))
    );
  })
);
