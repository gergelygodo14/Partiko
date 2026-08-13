import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    dish: { findMany: vi.fn() },
    weeklyMenu: { findMany: vi.fn() },
  },
}));

const { buildCandidatePool, buildPickPrompt, normalizeDishName, SUGGESTION_COUNT } = await import(
  "@/lib/dishSuggestion"
);

describe("normalizeDishName", () => {
  it("trims and lowercases for comparison", () => {
    expect(normalizeDishName("  Csirkemell Rizzsel  ")).toBe("csirkemell rizzsel");
  });
});

describe("buildCandidatePool", () => {
  const pool = ["Csirkemell rizzsel", "Sertéskaraj tésztával", "Rakott karfiol", "Túrós csusza"];

  it("removes exact matches from the exclude list", () => {
    expect(buildCandidatePool(pool, ["Sertéskaraj tésztával"])).toEqual([
      "Csirkemell rizzsel",
      "Rakott karfiol",
      "Túrós csusza",
    ]);
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(buildCandidatePool(pool, ["  csirkemell RIZZSEL  "])).toEqual([
      "Sertéskaraj tésztával",
      "Rakott karfiol",
      "Túrós csusza",
    ]);
  });

  it("returns the full pool when nothing is excluded", () => {
    expect(buildCandidatePool(pool, [])).toEqual(pool);
  });

  it("ignores blank exclude entries", () => {
    expect(buildCandidatePool(pool, ["", "   "])).toEqual(pool);
  });

  it("can exclude everything, leaving an empty pool", () => {
    expect(buildCandidatePool(pool, pool)).toEqual([]);
  });

  it("catches the same dish under a reordered name with an extra suffix (real reported case)", () => {
    const result = buildCandidatePool(
      ["Carbonara spagetti", "Rakott karfiol"],
      ["Spagetti carbonara reszelt sajttal"]
    );
    expect(result).toEqual(["Rakott karfiol"]);
  });

  it("catches a reordered duplicate the other way round too", () => {
    const result = buildCandidatePool(
      ["Spagetti carbonara reszelt sajttal", "Rakott karfiol"],
      ["Carbonara spagetti"]
    );
    expect(result).toEqual(["Rakott karfiol"]);
  });

  it("does not flag different dishes that merely share one common word", () => {
    // Both start with "Rántott" but are different dishes (different main
    // ingredient) - the near-duplicate check must not treat that as a match.
    const result = buildCandidatePool(["Rántott sertésszelet"], ["Rántott csirkemell"]);
    expect(result).toEqual(["Rántott sertésszelet"]);
  });

  it("does not flag unrelated dishes that happen to share no words", () => {
    const result = buildCandidatePool(["Túrós csusza"], ["Rakott karfiol"]);
    expect(result).toEqual(["Túrós csusza"]);
  });
});

describe("buildPickPrompt", () => {
  it("lists every candidate with its index", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel", "Rakott karfiol"], []);
    expect(prompt).toContain("0: Csirkemell rizzsel");
    expect(prompt).toContain("1: Rakott karfiol");
  });

  it("instructs the model to only pick from the list", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], []);
    expect(prompt).toContain("Kizárólag a fenti listából választhatsz");
  });

  it("includes the same day's other two dishes when given", () => {
    const prompt = buildPickPrompt(
      ["Csirkemell rizzsel"],
      ["Sertéskaraj hasábburgonyával", "Rántott sajt rizzsel"]
    );
    expect(prompt).toContain(
      "Ugyanerre a napra a másik két fogás már el van döntve: Sertéskaraj hasábburgonyával, Rántott sajt rizzsel"
    );
  });

  it("falls back to 'nincs' when there are no same-day dishes yet", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], []);
    expect(prompt).toContain("Ugyanerre a napra a másik két fogás már el van döntve: nincs");
  });

  it("includes the rest of the week's already-decided dishes when given", () => {
    const prompt = buildPickPrompt(
      ["Csirkemell rizzsel"],
      [],
      ["Székelygulyás", "Rakott karfiol"]
    );
    expect(prompt).toContain(
      "A hét többi napján eddig ezek a fogások szerepelnek: Székelygulyás, Rakott karfiol"
    );
  });

  it("falls back to 'nincs' when no other dish is decided yet this week", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], []);
    expect(prompt).toContain("A hét többi napján eddig ezek a fogások szerepelnek: nincs");
  });

  it("instructs the model to avoid thematic/word repetition across the week, not just exact names", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], [], ["Székelygulyás"]);
    expect(prompt).toContain("kerüld a szóismétlést és a tartalmi/témabeli hasonlóságot is");
  });

  it("asks for the given count of distinct picks as an indices array", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel", "Rakott karfiol", "Túrós csusza"], [], [], 3);
    expect(prompt).toContain("3 KÜLÖNBÖZŐ");
    expect(prompt).toContain('{"indices": [szám, szám, ...]}');
    expect(prompt).toContain("pontosan 3 db, egymástól különböző sorszám");
  });

  it("defaults the count to SUGGESTION_COUNT when not given", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], []);
    expect(prompt).toContain(`${SUGGESTION_COUNT} KÜLÖNBÖZŐ`);
  });

  it("instructs the model to make the picks distinct from each other, not just from the exclusions", () => {
    const prompt = buildPickPrompt(["Csirkemell rizzsel"], []);
    expect(prompt).toContain("választott fogás EGYMÁSTÓL is különbözzön");
  });
});
