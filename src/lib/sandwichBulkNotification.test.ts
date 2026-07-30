import { describe, expect, it } from "vitest";
import { buildSandwichBulkEntryNotificationText } from "@/lib/sandwichBulkNotification";

const BASE = {
  date: "2026-08-03",
  weekday: 0,
  changedStoreNames: ["Doma", "Dettre"],
  storeCount: 12,
  totalQuantity: 187,
  totalValueFt: 214300,
};

describe("buildSandwichBulkEntryNotificationText", () => {
  it("names the weekday, the date and the day's totals", () => {
    const text = buildSandwichBulkEntryNotificationText(BASE)!;
    expect(text).toContain("Rendelésfelvétel – Hétfő (2026-08-03)");
    expect(text).toContain("12 bolt · 187 db");
  });

  it("formats Ft with Hungarian thousands separators", () => {
    const text = buildSandwichBulkEntryNotificationText(BASE)!;
    expect(text).toContain(`${(214300).toLocaleString("hu-HU")} Ft`);
  });

  it("lists the changed stores", () => {
    const text = buildSandwichBulkEntryNotificationText(BASE)!;
    expect(text).toContain("Módosult: Doma, Dettre");
  });

  it("truncates a long changed-store list with a +N suffix", () => {
    const text = buildSandwichBulkEntryNotificationText({
      ...BASE,
      changedStoreNames: ["A", "B", "C", "D", "E"],
    })!;
    expect(text).toContain("Módosult: A, B, C +2");
  });

  it("lists exactly three stores without a suffix", () => {
    const text = buildSandwichBulkEntryNotificationText({
      ...BASE,
      changedStoreNames: ["A", "B", "C"],
    })!;
    expect(text).toContain("Módosult: A, B, C");
    expect(text).not.toContain("+");
  });

  // The anti-spam rule: pressing send five times while fixing a typo must
  // produce one notification, not five.
  it("returns null when nothing actually changed", () => {
    expect(buildSandwichBulkEntryNotificationText({ ...BASE, changedStoreNames: [] })).toBeNull();
  });

  it("names each weekday correctly", () => {
    const names = [0, 1, 2, 3, 4].map(
      (weekday) => buildSandwichBulkEntryNotificationText({ ...BASE, weekday })!.split("\n")[0]
    );
    expect(names).toEqual([
      "📋 Rendelésfelvétel – Hétfő (2026-08-03)",
      "📋 Rendelésfelvétel – Kedd (2026-08-03)",
      "📋 Rendelésfelvétel – Szerda (2026-08-03)",
      "📋 Rendelésfelvétel – Csütörtök (2026-08-03)",
      "📋 Rendelésfelvétel – Péntek (2026-08-03)",
    ]);
  });
});
