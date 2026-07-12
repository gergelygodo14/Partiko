import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysStr, todayStr } from "@/lib/dates";

const findFirst = vi.fn();
const aggregate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    billingPeriod: { findFirst: (...args: unknown[]) => findFirst(...args) },
    entry: { aggregate: (...args: unknown[]) => aggregate(...args) },
  },
}));

const { getOpenPeriod } = await import("@/lib/billing");

beforeEach(() => {
  findFirst.mockReset();
  aggregate.mockReset();
});

describe("getOpenPeriod", () => {
  it("starts the day after the last closed period", async () => {
    findFirst.mockResolvedValue({
      to: new Date("2026-06-30T00:00:00.000Z"),
      closedAt: new Date("2026-07-01T08:00:00.000Z"),
    });

    const period = await getOpenPeriod();

    expect(period.from).toBe("2026-07-01");
    expect(period.to).toBe(todayStr());
    expect(period.lastClosedAt).toBe("2026-07-01T08:00:00.000Z");
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("falls back to the earliest entry date when nothing was ever closed", async () => {
    findFirst.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _min: { date: new Date("2026-01-05T00:00:00.000Z") } });

    const period = await getOpenPeriod();

    expect(period.from).toBe("2026-01-05");
    expect(period.to).toBe(todayStr());
    expect(period.lastClosedAt).toBeNull();
  });

  it("falls back to today when there are no entries and no closed periods", async () => {
    findFirst.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _min: { date: null } });

    const period = await getOpenPeriod();

    expect(period.from).toBe(todayStr());
    expect(period.to).toBe(todayStr());
    expect(period.lastClosedAt).toBeNull();
  });

  it("lets `from` land after `to` when the last period was closed today - nothing is open yet", async () => {
    // Intentional: today is already inside the just-closed period, so the
    // open range must NOT include it too, or the Összesítő summary would
    // double-count today's (already billed) entries as still unbilled.
    findFirst.mockResolvedValue({
      to: new Date(`${todayStr()}T00:00:00.000Z`),
      closedAt: new Date(),
    });

    const period = await getOpenPeriod();

    expect(period.from).toBe(addDaysStr(todayStr(), 1));
    expect(period.to).toBe(todayStr());
  });
});
