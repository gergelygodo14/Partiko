import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/bejelentkezes"]);
const PUBLIC_API_PREFIXES = ["/api/public/", "/api/auth/", "/api/cron/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Bejelentkezés szükséges" }, { status: 401 });
  }

  const loginUrl = new URL("/bejelentkezes", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next internals and common static asset extensions -
  // /api/public/** and /api/auth/** (needed unauthenticated by the
  // customer-ordering site and the login flow itself) and /api/cron/**
  // (called by Vercel Cron, authenticated via its own CRON_SECRET check
  // inside the route) are exempted inside proxy() above instead, since
  // /api as a whole must otherwise stay gated.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)",
  ],
};
