import { describe, expect, it } from "vitest";
import { buildOrderNotificationText } from "@/lib/orderNotification";
import { emptyOrderWeek } from "@/lib/orders";

describe("buildOrderNotificationText", () => {
  it("labels a first-time submission as a new order", () => {
    const text = buildOrderNotificationText({
      storeName: "Zöld Bolt",
      weekStart: "2026-07-13",
      weekEnd: "2026-07-17",
      days: emptyOrderWeek(),
      isNew: true,
    });
    expect(text).toContain("🆕 Új rendelés – Zöld Bolt");
    expect(text).toContain("2026-07-13 – 2026-07-17");
  });

  it("labels a resubmission as a modified order", () => {
    const text = buildOrderNotificationText({
      storeName: "Zöld Bolt",
      weekStart: "2026-07-13",
      weekEnd: "2026-07-17",
      days: emptyOrderWeek(),
      isNew: false,
    });
    expect(text).toContain("✏️ Módosított rendelés – Zöld Bolt");
  });

  it("lists only the days that have a nonzero quantity", () => {
    const days = emptyOrderWeek();
    days[0] = { ...days[0], a: 2, c: 1 };
    days[3] = { ...days[3], b: 5, bXl: 1 };
    const text = buildOrderNotificationText({
      storeName: "Alma Büfé",
      weekStart: "2026-07-13",
      weekEnd: "2026-07-17",
      days,
      isNew: true,
    });
    expect(text).toContain("Hétfő: A: 2, C: 1");
    expect(text).toContain("Csütörtök: B: 5 (+1 XL)");
    expect(text).not.toContain("Kedd:");
    expect(text).not.toContain("Szerda:");
    expect(text).not.toContain("Péntek:");
  });

  it("shows a placeholder when nothing was ordered", () => {
    const text = buildOrderNotificationText({
      storeName: "Üres Bolt",
      weekStart: "2026-07-13",
      weekEnd: "2026-07-17",
      days: emptyOrderWeek(),
      isNew: true,
    });
    expect(text).toContain("(nincs tétel)");
    expect(text).toContain("Összesen: 0 adag, 0 Ft");
  });

  it("sums total meals (XL counts as 1 unit) and Ft value (XL priced higher)", () => {
    const days = emptyOrderWeek();
    days[0] = { ...days[0], a: 2, aXl: 1 };
    const text = buildOrderNotificationText({
      storeName: "Alma Büfé",
      weekStart: "2026-07-13",
      weekEnd: "2026-07-17",
      days,
      isNew: true,
    });
    expect(text).toContain("Összesen: 3 adag, 3900 Ft");
  });
});
