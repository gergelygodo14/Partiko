import { describe, expect, it } from "vitest";
import { buildSandwichOrderNotificationText } from "@/lib/sandwichOrderNotification";

describe("buildSandwichOrderNotificationText", () => {
  it("labels a first-time submission as a new order", () => {
    const text = buildSandwichOrderNotificationText({
      storeName: "Zöld Bolt",
      orderDate: "2026-07-14",
      dayName: "Kedd",
      lines: [],
      isNew: true,
    });
    expect(text).toContain("🆕 Új szendvics rendelés – Zöld Bolt");
    expect(text).toContain("Kedd (2026-07-14)");
  });

  it("labels a resubmission as a modified order", () => {
    const text = buildSandwichOrderNotificationText({
      storeName: "Zöld Bolt",
      orderDate: "2026-07-14",
      dayName: "Kedd",
      lines: [],
      isNew: false,
    });
    expect(text).toContain("✏️ Módosított szendvics rendelés – Zöld Bolt");
  });

  it("lists each nonzero item with its quantity", () => {
    const text = buildSandwichOrderNotificationText({
      storeName: "Alma Büfé",
      orderDate: "2026-07-14",
      dayName: "Kedd",
      lines: [
        { itemName: "Hamburger", quantity: 2, unitPriceFt: 700 },
        { itemName: "Molnárka", quantity: 0, unitPriceFt: 430 },
      ],
      isNew: true,
    });
    expect(text).toContain("Hamburger: 2");
    expect(text).not.toContain("Molnárka");
  });

  it("shows a placeholder when nothing was ordered", () => {
    const text = buildSandwichOrderNotificationText({
      storeName: "Üres Bolt",
      orderDate: "2026-07-14",
      dayName: "Kedd",
      lines: [],
      isNew: true,
    });
    expect(text).toContain("(nincs tétel)");
    expect(text).toContain("Összesen: 0 db, 0 Ft");
  });

  it("sums total count and Ft value", () => {
    const text = buildSandwichOrderNotificationText({
      storeName: "Alma Büfé",
      orderDate: "2026-07-14",
      dayName: "Kedd",
      lines: [
        { itemName: "Hamburger", quantity: 2, unitPriceFt: 700 },
        { itemName: "Molnárka", quantity: 3, unitPriceFt: 430 },
      ],
      isNew: true,
    });
    expect(text).toContain("Összesen: 5 db, 2690 Ft");
  });
});
