import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { corsPreflight, withCors } from "@/lib/cors";

function requestWithOrigin(origin: string | null) {
  return new NextRequest("http://localhost:3000/api/public/orders", {
    headers: origin ? { origin } : {},
  });
}

describe("withCors", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds no CORS headers when ALLOWED_ORIGINS is unset", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "");
    const handler = withCors(async () => NextResponse.json({ ok: true }));
    const res = await handler(requestWithOrigin("http://evil.example"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("echoes back an allow-listed origin", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:3100,https://partiko-landing.vercel.app");
    const handler = withCors(async () => NextResponse.json({ ok: true }));
    const res = await handler(requestWithOrigin("http://localhost:3100"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3100");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("does not grant CORS headers to a non-allow-listed origin", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:3100");
    const handler = withCors(async () => NextResponse.json({ ok: true }));
    const res = await handler(requestWithOrigin("http://evil.example"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("preserves the wrapped response body and status", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "");
    const handler = withCors(async () => NextResponse.json({ error: "nope" }, { status: 409 }));
    const res = await handler(requestWithOrigin(null));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "nope" });
  });
});

describe("corsPreflight", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 204 with allowed methods and an echoed allow-listed origin", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:3100");
    const res = corsPreflight(requestWithOrigin("http://localhost:3100"), "GET, PUT, OPTIONS");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, PUT, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3100");
  });
});
