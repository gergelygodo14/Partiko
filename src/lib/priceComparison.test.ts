import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}));

const { getPriceComparison } = await import("@/lib/priceComparison");

function obs(supplier: string, unitPrice: number, observedDate: string) {
  return { supplier, unitPrice, observedDate: new Date(observedDate) };
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
