import { beforeEach, describe, expect, it, vi } from "vitest";

const importRunFindUnique = vi.fn();
const importRunCreate = vi.fn();
const productFindMany = vi.fn();
const productCreate = vi.fn();
const observationCreateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    priceListImportRun: {
      findUnique: (...args: unknown[]) => importRunFindUnique(...args),
      create: (...args: unknown[]) => importRunCreate(...args),
    },
    product: {
      findMany: (...args: unknown[]) => productFindMany(...args),
      create: (...args: unknown[]) => productCreate(...args),
    },
    priceObservation: {
      createMany: (...args: unknown[]) => observationCreateMany(...args),
    },
  },
}));

const { ingestPriceList, buildPriceListNotificationText } = await import("@/lib/priceListIngestion");

beforeEach(() => {
  importRunFindUnique.mockReset();
  importRunCreate.mockReset();
  productFindMany.mockReset();
  productCreate.mockReset();
  observationCreateMany.mockReset();
});

describe("ingestPriceList", () => {
  it("skips already-processed emails (dedup by message id)", async () => {
    importRunFindUnique.mockResolvedValue({ productCount: 42 });

    const result = await ingestPriceList("msg-1", "BAROMFIUDVAR", { validFrom: null, items: [] });

    expect(result).toEqual({ status: "already_processed", productCount: 42 });
    expect(productFindMany).not.toHaveBeenCalled();
    expect(observationCreateMany).not.toHaveBeenCalled();
  });

  it("matches existing confirmed products and batches the observation inserts", async () => {
    importRunFindUnique.mockResolvedValue(null);
    productFindMany.mockResolvedValue([{ id: "prod-1", name: "Csirke mellfilé" }]);
    observationCreateMany.mockResolvedValue({ count: 1 });
    importRunCreate.mockResolvedValue({});

    const result = await ingestPriceList("msg-2", "BAROMFIUDVAR", {
      validFrom: new Date(2026, 6, 13),
      items: [{ name: "Csirke mellfilé", unit: "kg", unitPrice: 1899 }],
    });

    expect(productCreate).not.toHaveBeenCalled();
    expect(observationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          productId: "prod-1",
          supplier: "BAROMFIUDVAR",
          unitPrice: 1899,
          unit: "kg",
          observedDate: new Date(2026, 6, 13),
          source: "EMAIL_PRICELIST",
          rawText: "Csirke mellfilé",
        },
      ],
    });
    expect(importRunCreate).toHaveBeenCalledWith({
      data: { emailMessageId: "msg-2", supplier: "BAROMFIUDVAR", productCount: 1 },
    });
    expect(result).toEqual({ status: "imported", productCount: 1 });
  });

  it("auto-confirms newly created products (no PENDING review for email-sourced items)", async () => {
    importRunFindUnique.mockResolvedValue(null);
    productFindMany.mockResolvedValue([]);
    productCreate.mockResolvedValue({ id: "prod-new", name: "Fagyos csirke szárny" });
    observationCreateMany.mockResolvedValue({ count: 1 });
    importRunCreate.mockResolvedValue({});

    await ingestPriceList("msg-3", "BAROMFIUDVAR", {
      validFrom: null,
      items: [{ name: "Fagyos csirke szárny", unit: "kg", unitPrice: 659 }],
    });

    expect(productCreate).toHaveBeenCalledWith({
      data: { name: "Fagyos csirke szárny", unit: "kg", status: "CONFIRMED" },
    });
  });

  it("does not create duplicate products for repeated names within the same import", async () => {
    importRunFindUnique.mockResolvedValue(null);
    productFindMany.mockResolvedValue([]);
    productCreate.mockResolvedValue({ id: "prod-new", name: "Csomagolt tojás" });
    observationCreateMany.mockResolvedValue({ count: 2 });
    importRunCreate.mockResolvedValue({});

    await ingestPriceList("msg-4", "BAROMFIUDVAR", {
      validFrom: null,
      items: [
        { name: "Csomagolt tojás", unit: "db", unitPrice: 76 },
        { name: "Csomagolt tojás", unit: "db", unitPrice: 76 },
      ],
    });

    expect(productCreate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the current date when the list has no valid-from header", async () => {
    importRunFindUnique.mockResolvedValue(null);
    productFindMany.mockResolvedValue([{ id: "prod-1", name: "Sertéskaraj" }]);
    observationCreateMany.mockResolvedValue({ count: 1 });
    importRunCreate.mockResolvedValue({});

    await ingestPriceList("msg-5", "SAJTFUTAR", {
      validFrom: null,
      items: [{ name: "Sertéskaraj", unit: "kg", unitPrice: 1999 }],
    });

    const observedDate = observationCreateMany.mock.calls[0][0].data[0].observedDate as Date;
    expect(observedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});

describe("buildPriceListNotificationText", () => {
  it("names the supplier and product count", () => {
    expect(buildPriceListNotificationText("BAROMFIUDVAR", 159)).toBe(
      "🧾 Új Baromfiudvar árközlő feldolgozva: 159 termék."
    );
  });

  it("uses the Hungarian label for Sajtfutár too", () => {
    expect(buildPriceListNotificationText("SAJTFUTAR", 12)).toBe(
      "🧾 Új Sajtfutár árközlő feldolgozva: 12 termék."
    );
  });
});
