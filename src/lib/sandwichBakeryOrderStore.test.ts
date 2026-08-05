import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    sandwichBakeryOrder: {
      upsert: (...args: unknown[]) => upsert(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

const { getBakeryOrderForDate, saveBakeryOrder } = await import("@/lib/sandwichBakeryOrderStore");

beforeEach(() => {
  upsert.mockReset();
  findUnique.mockReset();
});

describe("saveBakeryOrder", () => {
  it("upserts by date so a second send for the same day overwrites the first", async () => {
    const rows = [{ key: "vekni" as const, label: "Vekni", toOrder: 12, leftover: 2 }];
    await saveBakeryOrder("2026-08-03", rows);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where.date.toISOString().slice(0, 10)).toBe("2026-08-03");
    expect(call.create.rows).toEqual(rows);
    expect(call.update.rows).toEqual(rows);
  });
});

describe("getBakeryOrderForDate", () => {
  it("returns the stored rows when a record exists", async () => {
    const rows = [{ key: "kmol", label: "Kmol", toOrder: 4, leftover: 0 }];
    findUnique.mockResolvedValue({ id: "1", rows, sentAt: new Date() });

    const result = await getBakeryOrderForDate("2026-08-03");
    expect(result).toEqual(rows);
  });

  it("returns null when nothing was ever sent for that date", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getBakeryOrderForDate("2026-08-03")).toBeNull();
  });
});
