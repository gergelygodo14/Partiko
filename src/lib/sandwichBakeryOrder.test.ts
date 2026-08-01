import { describe, expect, it } from "vitest";
import {
  BAKERY_PRODUCTS,
  buildBakeryOrderNotificationText,
  computeBakeryNeeds,
  computeBakeryOrderRows,
} from "@/lib/sandwichBakeryOrder";

describe("computeBakeryNeeds", () => {
  it("sums multiple sandwich items that share the same bread into one bakery product", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Fasírtos-pfefferonis szendvics", quantity: 3 },
      { itemName: "Rántott húsos vekni", quantity: 5 },
    ]);
    expect(needs.find((n) => n.key === "vekni")?.needed).toBe(8);
  });

  it("keeps teljes kiőrlésű vekni separate from the regular vekni", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Rántott húsos vekni", quantity: 4 },
      { itemName: "Rántott húsos vekni (teljes kiőrlésű)", quantity: 2 },
    ]);
    expect(needs.find((n) => n.key === "vekni")?.needed).toBe(4);
    expect(needs.find((n) => n.key === "tkVekni")?.needed).toBe(2);
  });

  it("sums all 3 molnárka variants into kmol", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Molnárka (kicsi) kolbászos", quantity: 1 },
      { itemName: "Molnárka (kicsi) sonkás", quantity: 2 },
      { itemName: "Molnárka (kicsi) szalámis", quantity: 3 },
    ]);
    expect(needs.find((n) => n.key === "kmol")?.needed).toBe(6);
  });

  it("sums both bigkifli variants into hot-dog", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Csirkemelles bigkifli", quantity: 2 },
      { itemName: "Fetasajtos bigkifli", quantity: 7 },
    ]);
    expect(needs.find((n) => n.key === "hotdog")?.needed).toBe(9);
  });

  it("sums dupla szalámis pogácsa and pötyi pogi into pogácsa", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Dupla szalámis pogácsa", quantity: 4 },
      { itemName: "Pötyi pogi (dupla rántott húsos pogácsa)", quantity: 1 },
    ]);
    expect(needs.find((n) => n.key === "pogacsa")?.needed).toBe(5);
  });

  it("sums sajtburger and dupla sajtburger into sajtburger", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Sajtburger", quantity: 6 },
      { itemName: "Dupla sajtburger", quantity: 2 },
    ]);
    expect(needs.find((n) => n.key === "sajtburger")?.needed).toBe(8);
  });

  it("sums karajos, piccante and szegedi sonkás vekni into szegedi vekni", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Mediterrán karajos vekni", quantity: 1 },
      { itemName: "Piccante szalámis (olasz, csípős)", quantity: 2 },
      { itemName: "Szegedi sonkás vekni", quantity: 3 },
    ]);
    expect(needs.find((n) => n.key === "szegediVekni")?.needed).toBe(6);
  });

  it("ignores items that don't map to any bakery product (tortilla, panini, tépett húsos)", () => {
    const needs = computeBakeryNeeds([
      { itemName: "Csirkés tortilla", quantity: 5 },
      { itemName: "Csirkés panini", quantity: 5 },
      { itemName: "Tépett húsos szendvics", quantity: 5 },
    ]);
    expect(needs.every((n) => n.needed === 0)).toBe(true);
  });

  it("returns every bakery product in BAKERY_PRODUCTS order, even at 0", () => {
    const needs = computeBakeryNeeds([]);
    expect(needs.map((n) => n.key)).toEqual(BAKERY_PRODUCTS.map((p) => p.key));
    expect(needs.every((n) => n.needed === 0)).toBe(true);
  });
});

describe("computeBakeryOrderRows", () => {
  it("subtracts the leftover from the needed amount", () => {
    const needs = computeBakeryNeeds([{ itemName: "Sajtburger", quantity: 10 }]);
    const rows = computeBakeryOrderRows(needs, { sajtburger: 3 });
    expect(rows.find((r) => r.label === "Sajtburger")?.toOrder).toBe(7);
  });

  it("floors at 0 when the leftover exceeds what's needed", () => {
    const needs = computeBakeryNeeds([{ itemName: "Sajtburger", quantity: 2 }]);
    const rows = computeBakeryOrderRows(needs, { sajtburger: 10 });
    expect(rows.find((r) => r.label === "Sajtburger")?.toOrder).toBe(0);
  });

  it("treats a missing leftover as 0", () => {
    const needs = computeBakeryNeeds([{ itemName: "Nagyi kifli", quantity: 5 }]);
    const rows = computeBakeryOrderRows(needs, {});
    expect(rows.find((r) => r.label === "nagyi")?.toOrder).toBe(5);
  });
});

describe("buildBakeryOrderNotificationText", () => {
  it("lists only nonzero rows, one per line as 'label: Ndb'", () => {
    const text = buildBakeryOrderNotificationText({
      date: "2026-08-03",
      dayName: "Hétfő",
      isEstimate: false,
      rows: [
        { label: "Vekni", toOrder: 15 },
        { label: "Sós papucs", toOrder: 0 },
        { label: "Kmol", toOrder: 8 },
      ],
    });
    expect(text).toContain("Vekni: 15db");
    expect(text).toContain("Kmol: 8db");
    expect(text).not.toContain("Sós papucs");
  });

  it("marks the message as an estimate when isEstimate is true", () => {
    const text = buildBakeryOrderNotificationText({
      date: "2026-08-04",
      dayName: "Kedd",
      isEstimate: true,
      rows: [{ label: "Vekni", toOrder: 5 }],
    });
    expect(text).toContain("becslés");
  });

  it("says so when nothing needs ordering", () => {
    const text = buildBakeryOrderNotificationText({
      date: "2026-08-03",
      dayName: "Hétfő",
      isEstimate: false,
      rows: [{ label: "Vekni", toOrder: 0 }],
    });
    expect(text).toContain("nincs rendelendő tétel");
  });
});
