import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    dish: { findMany: vi.fn() },
    weeklyMenu: { findMany: vi.fn() },
  },
}));

const { buildCandidatePool, buildPickPrompt, normalizeDishName } = await import(
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
});
