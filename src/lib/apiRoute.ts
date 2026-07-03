import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

type RouteHandler<Args extends unknown[]> = (
  ...args: Args
) => Promise<NextResponse>;

/**
 * Wraps a Next.js route handler so Prisma/unexpected errors return clean
 * JSON responses instead of Next's default unhandled-exception 500 page.
 * Does not change behavior for requests that don't throw.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  handler: RouteHandler<Args>
): RouteHandler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return NextResponse.json({ error: "Nem található" }, { status: 404 });
        }
        if (error.code === "P2003") {
          return NextResponse.json(
            { error: "Érvénytelen hivatkozás" },
            { status: 400 }
          );
        }
      }
      console.error(error);
      return NextResponse.json(
        { error: "Szerverhiba történt" },
        { status: 500 }
      );
    }
  };
}
