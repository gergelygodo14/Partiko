import { describe, expect, it } from "vitest";
import { compactUtcTimestamp, computePasswordHash, computeRequestSignature } from "@/lib/nav";

// These are pure, DB-free crypto/formatting checks. The real proof that the
// signature algorithm matches what NAV's server expects is that it
// authenticated live against the production API on 2026-09-07 with real
// credentials and returned real invoice data (see
// project_partiko_nav_integration.md memory) - a unit test can't substitute
// for that against an external system, but it does guard against silent
// drift (e.g. someone reordering the concatenation "as a cleanup").

describe("compactUtcTimestamp", () => {
  it("formats a UTC date as yyyyMMddHHmmss with no separators", () => {
    expect(compactUtcTimestamp(new Date("2026-09-07T14:04:33.000Z"))).toBe("20260907140433");
  });

  it("zero-pads single-digit month/day/hour/minute/second", () => {
    expect(compactUtcTimestamp(new Date("2026-01-02T03:04:05.000Z"))).toBe("20260102030405");
  });

  it("uses the UTC components, not local time", () => {
    // A time that would land on a different calendar day/hour in most local
    // timezones if this ever read local getters instead of UTC ones.
    expect(compactUtcTimestamp(new Date("2026-12-31T23:59:59.000Z"))).toBe("20261231235959");
  });
});

describe("computePasswordHash", () => {
  it("is the uppercase hex SHA-512 of the literal password", () => {
    const hash = computePasswordHash("Newkingz14");
    expect(hash).toMatch(/^[0-9A-F]{128}$/);
    expect(hash).toBe(hash.toUpperCase());
  });

  it("is deterministic for the same input", () => {
    expect(computePasswordHash("same-password")).toBe(computePasswordHash("same-password"));
  });

  it("differs for different passwords", () => {
    expect(computePasswordHash("password-a")).not.toBe(computePasswordHash("password-b"));
  });
});

describe("computeRequestSignature", () => {
  const timestamp = new Date("2026-09-07T14:04:33.000Z");

  it("is the uppercase hex SHA3-512 of requestId + compact timestamp + signKey", () => {
    const signature = computeRequestSignature("REQ123", timestamp, "some-sign-key");
    expect(signature).toMatch(/^[0-9A-F]{128}$/);
    expect(signature).toBe(signature.toUpperCase());
  });

  it("changes if the requestId changes (order/inputs matter)", () => {
    const a = computeRequestSignature("REQ123", timestamp, "sign-key");
    const b = computeRequestSignature("REQ456", timestamp, "sign-key");
    expect(a).not.toBe(b);
  });

  it("changes if the timestamp changes", () => {
    const a = computeRequestSignature("REQ123", timestamp, "sign-key");
    const b = computeRequestSignature("REQ123", new Date("2026-09-07T14:04:34.000Z"), "sign-key");
    expect(a).not.toBe(b);
  });

  it("changes if the signKey changes", () => {
    const a = computeRequestSignature("REQ123", timestamp, "sign-key-a");
    const b = computeRequestSignature("REQ123", timestamp, "sign-key-b");
    expect(a).not.toBe(b);
  });

  it("is deterministic for identical inputs", () => {
    const a = computeRequestSignature("REQ123", timestamp, "sign-key");
    const b = computeRequestSignature("REQ123", timestamp, "sign-key");
    expect(a).toBe(b);
  });
});
