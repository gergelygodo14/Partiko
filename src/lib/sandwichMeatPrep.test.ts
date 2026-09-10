import { describe, expect, it } from "vitest";
import { computeMeatPrep } from "@/lib/sandwichMeatPrep";

describe("computeMeatPrep", () => {
  it("sums 1x-multiplier rántott húsos items into rantottHusDb", () => {
    const totals = computeMeatPrep([
      { itemName: "Rántott húsos vekni", quantity: 3 },
      { itemName: "Rántott húsos vekni (teljes kiőrlésű)", quantity: 2 },
      { itemName: "Rántott húsos papucs", quantity: 4 },
    ]);
    expect(totals).toEqual({ rantottHusDb: 9, tortillaHusDb: 0, grillHusDkg: 0, hotdogVirsliDb: 0 });
  });

  it("counts Pötyi pogi double (2x rántott hús per portion)", () => {
    const totals = computeMeatPrep([{ itemName: "Pötyi pogi (dupla rántott húsos pogácsa)", quantity: 5 }]);
    expect(totals.rantottHusDb).toBe(10);
  });

  it("counts tortilla and panini double (2x tortilla hús per portion)", () => {
    const totals = computeMeatPrep([
      { itemName: "Csirkés tortilla", quantity: 3 },
      { itemName: "Csirkés panini", quantity: 2 },
    ]);
    expect(totals.tortillaHusDb).toBe(10); // 3*2 + 2*2
  });

  it("converts grill papucs and both bigkifli variants to raw dkg at 4dkg per portion", () => {
    const totals = computeMeatPrep([
      { itemName: "Grillezett csirkemell papucs", quantity: 2 },
      { itemName: "Csirkemelles bigkifli", quantity: 3 },
      { itemName: "Fetasajtos bigkifli", quantity: 4 },
    ]);
    // 9 portions * 4dkg
    expect(totals.grillHusDkg).toBe(36);
  });

  // 2026-09-10 owner request: 1 virsli per Hotdog, tracked the same way as
  // the other meats (a "last week" estimate reads off this same total).
  it("counts 1 virsli per Hotdog", () => {
    const totals = computeMeatPrep([{ itemName: "Hotdog", quantity: 7 }]);
    expect(totals.hotdogVirsliDb).toBe(7);
  });

  it("ignores items that don't consume any of the tracked meats", () => {
    const totals = computeMeatPrep([
      { itemName: "Sajtburger", quantity: 10 },
      { itemName: "Hamburger", quantity: 10 },
    ]);
    expect(totals).toEqual({ rantottHusDb: 0, tortillaHusDb: 0, grillHusDkg: 0, hotdogVirsliDb: 0 });
  });

  it("returns all zeros for an empty period", () => {
    expect(computeMeatPrep([])).toEqual({
      rantottHusDb: 0,
      tortillaHusDb: 0,
      grillHusDkg: 0,
      hotdogVirsliDb: 0,
    });
  });
});
