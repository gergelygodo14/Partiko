import { describe, expect, it } from "vitest";
import { isIskolaStore } from "@/lib/sandwichIskolaStores";

describe("isIskolaStore", () => {
  it("matches known schools case-insensitively", () => {
    expect(isIskolaStore("GYÍK")).toBe(true);
    expect(isIskolaStore("gyík")).toBe(true);
    expect(isIskolaStore("Szent Benedek")).toBe(true);
    expect(isIskolaStore("szent benedek")).toBe(true);
  });

  it("does not match in-town or vidék stores", () => {
    expect(isIskolaStore("Coop 103")).toBe(false);
    expect(isIskolaStore("FAV Mars")).toBe(false);
    expect(isIskolaStore("Határ")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(isIskolaStore("  Déry  ")).toBe(true);
  });
});
