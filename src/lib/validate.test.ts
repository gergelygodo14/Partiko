import { describe, expect, it } from "vitest";
import { isValidDateStr, isValidMenuDay } from "@/lib/validate";
import { emptyDay } from "@/lib/weeklyMenu";

describe("isValidDateStr", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidDateStr("2026-07-03")).toBe(true);
  });

  it("accepts a leap-day date", () => {
    expect(isValidDateStr("2028-02-29")).toBe(true);
  });

  it("rejects a non-existent leap-day date", () => {
    expect(isValidDateStr("2026-02-29")).toBe(false);
  });

  it("rejects an out-of-range month", () => {
    expect(isValidDateStr("2026-13-01")).toBe(false);
  });

  it("rejects an out-of-range day", () => {
    expect(isValidDateStr("2026-01-40")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isValidDateStr("2026/07/03")).toBe(false);
    expect(isValidDateStr("not-a-date")).toBe(false);
    expect(isValidDateStr("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidDateStr(undefined)).toBe(false);
    expect(isValidDateStr(null)).toBe(false);
    expect(isValidDateStr(20260703)).toBe(false);
  });
});

describe("isValidMenuDay", () => {
  it("accepts an empty day", () => {
    expect(isValidMenuDay(emptyDay())).toBe(true);
  });

  it("accepts a fully filled day", () => {
    expect(
      isValidMenuDay({
        a: "Rántott sajt",
        aGM: false,
        b: "Grillcsirke",
        bGM: true,
        c: "Rakott karfiol",
        cGM: false,
      })
    ).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(isValidMenuDay({ a: "x", aGM: false, b: "y", bGM: false })).toBe(false);
  });

  it("rejects wrong field types", () => {
    expect(
      isValidMenuDay({ a: "x", aGM: "false", b: "y", bGM: false, c: "z", cGM: false })
    ).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isValidMenuDay(null)).toBe(false);
    expect(isValidMenuDay("nope")).toBe(false);
    expect(isValidMenuDay(undefined)).toBe(false);
  });
});
