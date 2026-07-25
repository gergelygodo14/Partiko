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

  describe("short paper-invoice OCR text against a long wholesale catalog name", () => {
    // Real production case (2026-07): the confirmed product name comes from
    // the verbose weekly price-list SKU text, but a paper invoice photo only
    // ever prints a short human description - the two are the same real
    // item, just very different lengths, which used to always fail to
    // match and force a manual re-merge on every single invoice.
    const zsemleCandidates = [
      {
        id: "zsemle-szezamos",
        name: "FAGYOS HAMBURGER ZSEMLE SZEZÁMMAGGAL SZÓRT 125 MM 82 G /DB. LANTMANNEN LÉDIG 24 DB /# 200917",
      },
      {
        id: "zsemle-brios",
        name: "FAGYOS BRIÓS STÍLUSÚ ZSEMLE 114 MM 110 G /DB. LANTMANNEN LÉDIG 30 DB /# 24160000",
      },
      {
        id: "zsemle-kukta",
        name: "FAGYOS KUKTA HAMBURGER ZSEMLE BRIÓS STÍLUSÚ 114 MM 110 G /DB. LÉDIG 30 DB /#",
      },
      {
        id: "zsemle-smash",
        name: "FAGYOS HAMBURGER ZSEMLE SMASH BURGER 65 G /DB. SALOMON LÉDIG 3X20 DB /# 5000334",
      },
    ];

    it("matches the short OCR text to its long catalog counterpart", () => {
      const match = findBestProductMatch(
        "GYF. HAMBURGER ZSEMLE SZEZÁMMAGGAL SZORT 125 MM 82 G",
        zsemleCandidates
      );
      expect(match?.id).toBe("zsemle-szezamos");
    });

    it("does not confuse it with a different, similarly-short-vs-long product", () => {
      const match = findBestProductMatch(
        "GYF. BRIÓS STÍLUSÚ ZSEMLE 114 MM 110 G",
        zsemleCandidates
      );
      expect(match?.id).toBe("zsemle-brios");
    });

    it("still requires a real match - a short but unrelated name returns null", () => {
      expect(findBestProductMatch("GYF. Trappista sajt szeletelt 1kg", zsemleCandidates)).toBeNull();
    });
  });
});
