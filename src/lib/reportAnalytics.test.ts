import { describe, expect, it } from "vitest";
import { computeItemTrends, rankItems } from "@/lib/reportAnalytics";

describe("rankItems", () => {
  it("returns the top and bottom N items by quantity, sorted best/worst first", () => {
    const byItem = [
      { itemId: "1", itemName: "A", quantity: 50 },
      { itemId: "2", itemName: "B", quantity: 40 },
      { itemId: "3", itemName: "C", quantity: 30 },
      { itemId: "4", itemName: "D", quantity: 20 },
      { itemId: "5", itemName: "E", quantity: 10 },
      { itemId: "6", itemName: "F", quantity: 5 },
      { itemId: "7", itemName: "G", quantity: 1 },
    ];
    const { topItems, bottomItems } = rankItems(byItem, 2);
    expect(topItems.map((i) => i.itemName)).toEqual(["A", "B"]);
    expect(bottomItems.map((i) => i.itemName)).toEqual(["G", "F"]);
  });

  it("excludes zero-quantity items entirely", () => {
    const byItem = [
      { itemId: "1", itemName: "A", quantity: 5 },
      { itemId: "2", itemName: "B", quantity: 0 },
    ];
    const { topItems, bottomItems } = rankItems(byItem, 5);
    expect(topItems.map((i) => i.itemName)).toEqual(["A"]);
    expect(bottomItems).toEqual([]);
  });

  it("never lets the same item appear in both top and bottom when the catalog is small", () => {
    const byItem = [
      { itemId: "1", itemName: "A", quantity: 3 },
      { itemId: "2", itemName: "B", quantity: 2 },
      { itemId: "3", itemName: "C", quantity: 1 },
    ];
    const { topItems, bottomItems } = rankItems(byItem, 5);
    const topIds = new Set(topItems.map((i) => i.itemId));
    for (const item of bottomItems) expect(topIds.has(item.itemId)).toBe(false);
  });

  it("returns everything as topItems with no bottomItems when there's only 1 distinct item", () => {
    const byItem = [{ itemId: "1", itemName: "A", quantity: 7 }];
    const { topItems, bottomItems } = rankItems(byItem, 5);
    expect(topItems.map((i) => i.itemName)).toEqual(["A"]);
    expect(bottomItems).toEqual([]);
  });
});

describe("computeItemTrends", () => {
  it("flags a big month-over-month increase", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Hamburger", quantity: 20 }],
      [{ itemId: "1", itemName: "Hamburger", quantity: 10 }]
    );
    expect(trends).toEqual([
      {
        itemId: "1",
        itemName: "Hamburger",
        currentQuantity: 20,
        previousQuantity: 10,
        changePercent: 100,
        direction: "up",
      },
    ]);
  });

  it("flags a big month-over-month decrease", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Hamburger", quantity: 5 }],
      [{ itemId: "1", itemName: "Hamburger", quantity: 20 }]
    );
    expect(trends[0]).toMatchObject({ direction: "down", changePercent: -75 });
  });

  it("flags an item that vanished entirely (present last period, absent now)", () => {
    const trends = computeItemTrends(
      [],
      [{ itemId: "1", itemName: "Hamburger", quantity: 15 }]
    );
    expect(trends[0]).toMatchObject({
      itemName: "Hamburger",
      currentQuantity: 0,
      previousQuantity: 15,
      changePercent: -100,
      direction: "down",
    });
  });

  it("flags a debut item with changePercent null instead of a divide-by-zero", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Új szendvics", quantity: 12 }],
      []
    );
    expect(trends[0]).toMatchObject({
      currentQuantity: 12,
      previousQuantity: 0,
      changePercent: null,
      direction: "up",
    });
  });

  it("ignores small swings below the volume floor even if the percent change is huge", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Ritka", quantity: 3 }],
      [{ itemId: "1", itemName: "Ritka", quantity: 1 }]
    );
    expect(trends).toEqual([]);
  });

  it("ignores changes under the notability threshold even at high volume", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Stabil", quantity: 105 }],
      [{ itemId: "1", itemName: "Stabil", quantity: 100 }]
    );
    expect(trends).toEqual([]);
  });

  it("honors a custom minQuantity for units where 5 isn't a meaningful floor (e.g. Ft)", () => {
    const noOverride = computeItemTrends(
      [{ itemId: "1", itemName: "Liszt", quantity: 3 }],
      [{ itemId: "1", itemName: "Liszt", quantity: 1 }]
    );
    expect(noOverride).toEqual([]);

    const withLowerFloor = computeItemTrends(
      [{ itemId: "1", itemName: "Liszt", quantity: 3 }],
      [{ itemId: "1", itemName: "Liszt", quantity: 1 }],
      { minQuantity: 1 }
    );
    expect(withLowerFloor[0]).toMatchObject({ currentQuantity: 3, previousQuantity: 1 });
  });

  it("honors a custom thresholdPercent", () => {
    const trends = computeItemTrends(
      [{ itemId: "1", itemName: "Cukor", quantity: 110 }],
      [{ itemId: "1", itemName: "Cukor", quantity: 100 }],
      { thresholdPercent: 5 }
    );
    expect(trends[0]).toMatchObject({ changePercent: 10 });
  });

  it("sorts growth first, biggest swing first within each direction", () => {
    const trends = computeItemTrends(
      [
        { itemId: "1", itemName: "SmallGrow", quantity: 13 },
        { itemId: "2", itemName: "BigGrow", quantity: 30 },
        { itemId: "3", itemName: "BigDrop", quantity: 5 },
      ],
      [
        { itemId: "1", itemName: "SmallGrow", quantity: 10 },
        { itemId: "2", itemName: "BigGrow", quantity: 10 },
        { itemId: "3", itemName: "BigDrop", quantity: 20 },
      ]
    );
    expect(trends.map((t) => t.itemName)).toEqual(["BigGrow", "SmallGrow", "BigDrop"]);
  });
});
