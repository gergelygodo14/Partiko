import { describe, expect, it } from "vitest";
import { buildSuggestionPrompt, sampleExamples } from "@/lib/dishSuggestion";

describe("sampleExamples", () => {
  const pool = ["Étel A", "Étel B", "Étel C", "Étel D", "Étel E"];

  it("returns the requested number of items when enough are available", () => {
    expect(sampleExamples(3, pool)).toHaveLength(3);
  });

  it("returns unique items (no repeats within one sample)", () => {
    const sample = sampleExamples(5, pool);
    expect(new Set(sample).size).toBe(5);
  });

  it("caps at the pool size when count exceeds it", () => {
    expect(sampleExamples(10, pool)).toHaveLength(pool.length);
  });

  it("only draws from the given pool", () => {
    const sample = sampleExamples(3, pool);
    for (const item of sample) expect(pool).toContain(item);
  });
});

describe("buildSuggestionPrompt", () => {
  it("includes every example dish", () => {
    const prompt = buildSuggestionPrompt(["Csirkemell rizzsel", "Sertéskaraj tésztával"], []);
    expect(prompt).toContain("Csirkemell rizzsel");
    expect(prompt).toContain("Sertéskaraj tésztával");
  });

  it("lists the dishes to avoid when given", () => {
    const prompt = buildSuggestionPrompt(["Példa étel"], ["Grillezett csirkemell", "Rakott burgonya"]);
    expect(prompt).toContain("Grillezett csirkemell, Rakott burgonya");
  });

  it("falls back to 'nincs' when there is nothing to avoid", () => {
    const prompt = buildSuggestionPrompt(["Példa étel"], []);
    expect(prompt).toContain("nincs");
  });

  it("ignores blank entries in the avoid list", () => {
    const prompt = buildSuggestionPrompt(["Példa étel"], ["", "  ", "Valódi étel"]);
    expect(prompt).toContain("már szerepel (ne javasolj ehhez nagyon hasonlót vagy ugyanazt): Valódi étel");
  });

  it("lists the same day's other two dishes when given", () => {
    const prompt = buildSuggestionPrompt(
      ["Példa étel"],
      [],
      ["Csirkemell rizzsel", "Sertéskaraj hasábburgonyával"]
    );
    expect(prompt).toContain(
      "Ugyanerre a napra a másik két fogás már el van döntve: Csirkemell rizzsel, Sertéskaraj hasábburgonyával"
    );
  });

  it("falls back to 'nincs' when there are no same-day dishes yet", () => {
    const prompt = buildSuggestionPrompt(["Példa étel"], []);
    expect(prompt).toContain("Ugyanerre a napra a másik két fogás már el van döntve: nincs");
  });
});
