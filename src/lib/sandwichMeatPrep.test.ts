import { describe, expect, it } from "vitest";
import { computeMeatPrep } from "@/lib/sandwichMeatPrep";

describe("computeMeatPrep", () => {
  it("sums 1x-multiplier rántott húsos items into rantottHusDb", () => {
    const totals = computeMeatPrep([
      { itemName: "Rántott húsos vekni", quantity: 3 },
      { itemName: "Rántott húsos vekni (teljes kiőrlésű)", quantity: 2 },
      { itemName: "Rántott húsos papucs", quantity: 4 },
    ]);
    expect(totals).toEqual({ rantottHusDb: 9, tortillaHusDb: 0, grillHusDb: 0 });
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

  it("counts grill papucs and both bigkifli variants at 1x grill hús", () => {
    const totals = computeMeatPrep([
      { itemName: "Grillezett csirkemell papucs", quantity: 2 },
      { itemName: "Csirkemelles bigkifli", quantity: 3 },
      { itemName: "Fetasajtos bigkifli", quantity: 4 },
    ]);
    expect(totals.grillHusDb).toBe(9);
  });

  it("ignores items that don't consume any of the three tracked meats", () => {
    const totals = computeMeatPrep([
      { itemName: "Sajtburger", quantity: 10 },
      { itemName: "Hamburger", quantity: 10 },
    ]);
    expect(totals).toEqual({ rantottHusDb: 0, tortillaHusDb: 0, grillHusDb: 0 });
  });

  it("returns all zeros for an empty period", () => {
    expect(computeMeatPrep([])).toEqual({ rantottHusDb: 0, tortillaHusDb: 0, grillHusDb: 0 });
  });
});
