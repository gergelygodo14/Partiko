import { describe, expect, it } from "vitest";
import { findBestProductMatch, normalizeProductName } from "@/lib/productMatching";

describe("normalizeProductName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeProductName("Csirkemell filé")).toBe("csirkemell file");
  });

  it("collapses punctuation/whitespace to single spaces", () => {
    expect(normalizeProductName("Csirke-mell,  filé!")).toBe("csirke mell file");
  });
});

describe("findBestProductMatch", () => {
  const candidates = [
    { id: "1", name: "Csirke mellfilé" },
    { id: "2", name: "Sertéskaraj" },
    { id: "3", name: "Trappista sajt" },
  ];

  it("returns an exact match after normalization", () => {
    expect(findBestProductMatch("csirke mellfile", candidates)).toEqual(candidates[0]);
  });

  it("matches near-identical wording/word-order noise", () => {
    expect(findBestProductMatch("Csirkemell filé", candidates)?.id).toBe("1");
  });

  it("returns null when nothing is close enough", () => {
    expect(findBestProductMatch("Teljesen más termék", candidates)).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(findBestProductMatch("Csirke mellfilé", [])).toBeNull();
  });

  it("returns null for a blank input name", () => {
    expect(findBestProductMatch("   ", candidates)).toBeNull();
  });
});
