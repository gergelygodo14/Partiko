import { NextRequest, NextResponse } from "next/server";

function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !getAllowedOrigins().includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

// Only applied to routes under src/app/api/public/**, which need to be
// callable cross-origin from the standalone ordering frontend (and,
// eventually, the company landing site). Origins are allow-listed via the
// ALLOWED_ORIGINS env var (comma-separated) rather than "*" so the response
// stays origin-specific and cacheable correctly per the Vary header.
export function withCors<Args extends [NextRequest, ...unknown[]]>(
  handler: RouteHandler<Args>
): RouteHandler<Args> {
  return async (...args: Args) => {
    const response = await handler(...args);
    for (const [key, value] of Object.entries(corsHeaders(args[0]))) {
      response.headers.set(key, value);
    }
    return response;
  };
}

export function corsPreflight(request: NextRequest, methods: string): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
