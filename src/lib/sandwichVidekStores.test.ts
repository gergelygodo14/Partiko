import { describe, expect, it } from "vitest";
import { isVidekStore } from "@/lib/sandwichVidekStores";

describe("isVidekStore", () => {
  it("matches known countryside-route stores case-insensitively", () => {
    expect(isVidekStore("Határ")).toBe(true);
    expect(isVidekStore("kisszállás")).toBe(true);
    expect(isVidekStore("OMV")).toBe(true);
    expect(isVidekStore("omv")).toBe(true);
  });

  it("does not match in-town stores", () => {
    expect(isVidekStore("Coop 103")).toBe(false);
    expect(isVidekStore("FAV Mars")).toBe(false);
    expect(isVidekStore("NÁ")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(isVidekStore("  Határ  ")).toBe(true);
  });
});
