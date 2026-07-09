import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { corsPreflight, withCors } from "@/lib/cors";

const MAX_NAME_LENGTH = 200;

function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_NAME_LENGTH;
}

export const OPTIONS = (request: NextRequest) => corsPreflight(request, "POST, OPTIONS");

export const POST = withCors(
  withApiErrorHandling(async (request: NextRequest) => {
    const body = await request.json();
    const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";

    if (!isValidName(storeName)) {
      return NextResponse.json({ error: "Megrendelő/bolt neve kötelező" }, { status: 400 });
    }

    // Case-insensitive match so "Norbi" and "norbi" resolve to the same
    // customer - typed casing is still preserved as-is on first creation.
    let customer = await prisma.customer.findFirst({
      where: { storeName: { equals: storeName, mode: "insensitive" } },
    });
    if (!customer) {
      customer = await prisma.customer.create({ data: { storeName, companyName: "" } });
    }

    return NextResponse.json({
      customerId: customer.id,
      storeName: customer.storeName,
      companyName: customer.companyName,
    });
  })
);
