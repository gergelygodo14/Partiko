import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}));

const { getPriceComparison } = await import("@/lib/priceComparison");

function obs(supplier: string, unitPrice: number, observedDate: string, unit: string | null = null) {
  return { supplier, unitPrice, observedDate: new Date(observedDate), unit };
}

beforeEach(() => {
  findMany.mockReset();
});

describe("getPriceComparison", () => {
  it("returns null previousPrice and trend when there's only one observation", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Csirkemell",
        priceObservations: [obs("BAROMFIUDVAR", 1350, "2026-07-10")],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR).toEqual({
      price: 1350,
      date: "2026-07-10",
      trend: null,
      previousPrice: null,
      normalizedFrom: null,
    });
  });

  it("carries the previous unit price alongside an 'up' trend", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Csirkemell",
        priceObservations: [
          obs("BAROMFIUDVAR", 1350, "2026-07-10"),
          obs("BAROMFIUDVAR", 1200, "2026-07-03"),
        ],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR).toEqual({
      price: 1350,
      date: "2026-07-10",
      trend: "up",
      previousPrice: 1200,
      normalizedFrom: null,
    });
  });

  it("carries the previous unit price alongside a 'down' trend", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Csirkemell",
        priceObservations: [
          obs("BAROMFIUDVAR", 1100, "2026-07-10"),
          obs("BAROMFIUDVAR", 1200, "2026-07-03"),
        ],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR?.trend).toBe("down");
    expect(row.bySupplier.BAROMFIUDVAR?.previousPrice).toBe(1200);
  });

  it("reports 'same' trend with the unchanged previous price when nothing moved", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Csirkemell",
        priceObservations: [
          obs("BAROMFIUDVAR", 1200, "2026-07-10"),
          obs("BAROMFIUDVAR", 1200, "2026-07-03"),
        ],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR?.trend).toBe("same");
    expect(row.bySupplier.BAROMFIUDVAR?.previousPrice).toBe(1200);
  });

  it("divides a box-priced observation by packSize when the unit is doboz/karton/csomag", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ketchup mini párna",
        packSize: 150,
        priceObservations: [obs("BAROMFIUDVAR", 5986, "2026-07-20", "doboz")],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR).toEqual({
      price: 40,
      date: "2026-07-20",
      trend: null,
      previousPrice: null,
      normalizedFrom: { price: 5986, unit: "doboz" },
    });
  });

  it("leaves a per-piece observation untouched even when packSize is set", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ketchup mini párna",
        packSize: 150,
        priceObservations: [obs("SAJTFUTAR", 46, "2026-07-20", "db")],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.SAJTFUTAR).toEqual({
      price: 46,
      date: "2026-07-20",
      trend: null,
      previousPrice: null,
      normalizedFrom: null,
    });
  });

  it("makes a box-priced and a per-piece supplier comparable, picking the true cheaper one", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ketchup mini párna",
        packSize: 150,
        priceObservations: [
          obs("BAROMFIUDVAR", 5986, "2026-07-20", "doboz"),
          obs("SAJTFUTAR", 46, "2026-07-20", "db"),
        ],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR?.price).toBe(40);
    expect(row.bySupplier.SAJTFUTAR?.price).toBe(46);
    expect(row.cheaperSupplier).toBe("BAROMFIUDVAR");
  });

  it("computes the trend from normalized prices, not raw box prices", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ketchup mini párna",
        packSize: 150,
        priceObservations: [
          obs("BAROMFIUDVAR", 6750, "2026-07-20", "doboz"), // 45 Ft/db
          obs("BAROMFIUDVAR", 6000, "2026-07-13", "doboz"), // 40 Ft/db
        ],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR).toMatchObject({
      price: 45,
      previousPrice: 40,
      trend: "up",
    });
  });

  it("does not normalize when the product has no packSize set", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ketchup mini párna",
        packSize: null,
        priceObservations: [obs("BAROMFIUDVAR", 5986, "2026-07-20", "doboz")],
      },
    ]);

    const [row] = await getPriceComparison();

    expect(row.bySupplier.BAROMFIUDVAR?.price).toBe(5986);
    expect(row.bySupplier.BAROMFIUDVAR?.normalizedFrom).toBeNull();
  });

  it("breaks same-day observedDate ties by createdAt, not by whichever row comes back first", async () => {
    findMany.mockResolvedValue([]);
    await getPriceComparison();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          priceObservations: {
            orderBy: [{ observedDate: "desc" }, { createdAt: "desc" }],
          },
        },
      })
    );
  });
});
