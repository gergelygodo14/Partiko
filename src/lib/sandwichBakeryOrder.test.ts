import { describe, expect, it } from "vitest";
import {
  BAKERY_PRODUCTS,
  bakeryOrderPlan,
  buildBakeryOrderNotificationText,
  computeBakeryNeeds,
  computeBakeryOrderRows,
} from "@/lib/sandwichBakeryOrder";

// `hour` is Budapest local time; construct the equivalent UTC instant by
// subtracting the offset (CET=+1 in winter, CEST=+2 in summer).
function budapestInstant(dateStr: string, hour: number, utcOffsetHours: number): Date {
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  return new Date(utcMidnight + hour * 3600_000 - utcOffsetHours * 3600_000);
}

// Week of 2026-08-03 (Mon) - 2026-08-09 (Sun), summer => Budapest is CEST (+2).
describe("bakeryOrderPlan", () => {
  it("Sunday orders for Monday delivery, sized off Tuesday demand (estimate)", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-09", 12, 2))).toEqual({
      deliveryDate: "2026-08-10",
      dayName: "Hétfő",
      demandDate: "2026-08-11",
      sourceDayName: "Kedd",
      isEstimate: true,
    });
  });

  it("Monday orders for Tuesday delivery, sized off Wednesday demand (estimate)", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-03", 12, 2))).toEqual({
      deliveryDate: "2026-08-04",
      dayName: "Kedd",
      demandDate: "2026-08-05",
      sourceDayName: "Szerda",
      isEstimate: true,
    });
  });

  it("Tuesday orders for Wednesday delivery, sized off Thursday demand (estimate)", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-04", 12, 2))).toEqual({
      deliveryDate: "2026-08-05",
      dayName: "Szerda",
      demandDate: "2026-08-06",
      sourceDayName: "Csütörtök",
      isEstimate: true,
    });
  });

  it("Wednesday orders for Thursday delivery, sized off Friday demand (estimate)", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-05", 12, 2))).toEqual({
      deliveryDate: "2026-08-06",
      dayName: "Csütörtök",
      demandDate: "2026-08-07",
      sourceDayName: "Péntek",
      isEstimate: true,
    });
  });

  it("Thursday places no order", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-06", 12, 2))).toBeNull();
  });

  it("Friday places no order", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-07", 12, 2))).toBeNull();
  });

  it("Saturday orders for Sunday delivery, sized off Monday demand (exact, no estimate)", () => {
    expect(bakeryOrderPlan(budapestInstant("2026-08-08", 12, 2))).toEqual({
      deliveryDate: "2026-08-09",
      dayName: "Vasárnap",
      demandDate: "2026-08-10",
      sourceDayName: "Hétfő",
      isEstimate: false,
    });
  });
});

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
    const row = rows.find((r) => r.label === "nagyi");
    expect(row?.toOrder).toBe(5);
    expect(row?.leftover).toBe(0);
  });

  it("keeps the leftover figure on the row, not just folded into toOrder", () => {
    const needs = computeBakeryNeeds([{ itemName: "Sajtburger", quantity: 10 }]);
    const rows = computeBakeryOrderRows(needs, { sajtburger: 3 });
    expect(rows.find((r) => r.label === "Sajtburger")?.leftover).toBe(3);
  });
});

describe("buildBakeryOrderNotificationText", () => {
  it("lists only nonzero rows, one per line as 'label: Ndb'", () => {
    const text = buildBakeryOrderNotificationText({
      date: "2026-08-03",
      dayName: "Hétfő",
      isEstimate: false,
      rows: [
        { key: "vekni", label: "Vekni", toOrder: 15, leftover: 0 },
        { key: "sosPapucs", label: "Sós papucs", toOrder: 0, leftover: 0 },
        { key: "kmol", label: "Kmol", toOrder: 8, leftover: 0 },
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
      rows: [{ key: "vekni", label: "Vekni", toOrder: 5, leftover: 0 }],
    });
    expect(text).toContain("becslés");
  });

  it("says so when nothing needs ordering", () => {
    const text = buildBakeryOrderNotificationText({
      date: "2026-08-03",
      dayName: "Hétfő",
      isEstimate: false,
      rows: [{ key: "vekni", label: "Vekni", toOrder: 0, leftover: 0 }],
    });
    expect(text).toContain("nincs rendelendő tétel");
  });
});
