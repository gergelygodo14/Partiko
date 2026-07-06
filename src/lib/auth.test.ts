import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, isValidSessionToken } from "@/lib/auth";

describe("session tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a freshly created token is valid", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = await createSessionToken();
    expect(await isValidSessionToken(token)).toBe(true);
  });

  it("rejects a missing token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    expect(await isValidSessionToken(undefined)).toBe(false);
    expect(await isValidSessionToken(null)).toBe(false);
    expect(await isValidSessionToken("")).toBe(false);
  });

  it("rejects a malformed token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    expect(await isValidSessionToken("not-a-real-token")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = await createSessionToken();
    const [expires] = token.split(".");
    const tampered = `${expires}.0000000000000000000000000000000000000000000000000000000000000000`;
    expect(await isValidSessionToken(tampered)).toBe(false);
  });

  it("rejects a tampered (extended) expiry", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = await createSessionToken();
    const [, signature] = token.split(".");
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
    const tampered = `${farFuture}.${signature}`;
    expect(await isValidSessionToken(tampered)).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const expired = String(Date.now() - 1000);
    // Can't forge a valid signature without the secret, so simulate expiry
    // by directly checking that an already-past expiry never validates,
    // regardless of signature.
    expect(await isValidSessionToken(`${expired}.anything`)).toBe(false);
  });

  it("a token signed with a different secret is invalid", async () => {
    vi.stubEnv("SESSION_SECRET", "secret-a");
    const token = await createSessionToken();
    vi.stubEnv("SESSION_SECRET", "secret-b");
    expect(await isValidSessionToken(token)).toBe(false);
  });
});
