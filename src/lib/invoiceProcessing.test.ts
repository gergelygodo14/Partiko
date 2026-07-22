import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const productCreate = vi.fn();
const observationCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => productCreate(...args),
    },
    priceObservation: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => observationCreate(...args),
    },
  },
}));

const { buildPriceChangeNote, buildHighlightSummary, formatPriceChangeSummary, processInvoiceLineItems } =
  await import("@/lib/invoiceProcessing");

beforeEach(() => {
  findFirst.mockReset();
  findMany.mockReset();
  productCreate.mockReset();
  observationCreate.mockReset();
});

describe("buildPriceChangeNote", () => {
  it("carries through prior-same-supplier and other-supplier prices", () => {
    const note = buildPriceChangeNote(
      "Csirkemell",
      "Csirkemell",
      "BAROMFIUDVAR",
      1350,
      { supplier: "BAROMFIUDVAR", unitPrice: 1200 },
      { supplier: "SAJTFUTAR", unitPrice: 1300 }
    );
    expect(note).toEqual({
      productName: "Csirkemell",
      shortName: "Csirkemell",
      supplier: "BAROMFIUDVAR",
      newPrice: 1350,
      priorSamePrice: 1200,
      otherSupplierPrice: 1300,
      otherSupplier: "SAJTFUTAR",
    });
  });

  it("uses null fields when there is no prior history", () => {
    const note = buildPriceChangeNote("Sertéskaraj", "Sertéskaraj", "SAJTFUTAR", 2000, null, null);
    expect(note.priorSamePrice).toBeNull();
    expect(note.otherSupplierPrice).toBeNull();
    expect(note.otherSupplier).toBeNull();
  });
});

describe("formatPriceChangeSummary", () => {
  it("reports a price increase with percentage and flags the cheaper supplier", () => {
    const summary = formatPriceChangeSummary([
      buildPriceChangeNote(
        "Csirkemell",
        "Csirkemell",
        "BAROMFIUDVAR",
        1350,
        { supplier: "BAROMFIUDVAR", unitPrice: 1200 },
        { supplier: "SAJTFUTAR", unitPrice: 1300 }
      ),
    ]);
    expect(summary).toContain("1 tétel feldolgozva.");
    expect(summary).toContain("Csirkemell: 1200 → 1350 Ft");
    expect(summary).toContain("Baromfiudvarnál, nőtt 12.5%");
    expect(summary).toContain("most olcsóbb a Sajtfutárnál (1300 Ft)");
  });

  it("reports a price decrease", () => {
    const summary = formatPriceChangeSummary([
      buildPriceChangeNote(
        "Trappista sajt",
        "Trappista sajt",
        "SAJTFUTAR",
        900,
        { supplier: "SAJTFUTAR", unitPrice: 1000 },
        null
      ),
    ]);
    expect(summary).toContain("Trappista sajt: 1000 → 900 Ft");
    expect(summary).toContain("csökkent 10.0%");
  });

  it("omits the delta when the price is unchanged from the same supplier", () => {
    const summary = formatPriceChangeSummary([
      buildPriceChangeNote(
        "Sertéskaraj",
        "Sertéskaraj",
        "SAJTFUTAR",
        2000,
        { supplier: "SAJTFUTAR", unitPrice: 2000 },
        null
      ),
    ]);
    expect(summary).toContain("Sertéskaraj: 2000 Ft (Sajtfutárnál)");
    expect(summary).not.toContain("→");
  });

  it("notes when the current supplier is the cheaper one", () => {
    const summary = formatPriceChangeSummary([
      buildPriceChangeNote(
        "Csirkecomb",
        "Csirkecomb",
        "BAROMFIUDVAR",
        1000,
        null,
        { supplier: "SAJTFUTAR", unitPrice: 1200 }
      ),
    ]);
    expect(summary).toContain("most Baromfiudvarnál olcsóbb, mint a Sajtfutárnál (1200 Ft)");
  });

  it("returns a fallback message for an empty list", () => {
    expect(formatPriceChangeSummary([])).toBe("Nem sikerült egyetlen tételt sem feldolgozni.");
  });
});

describe("buildHighlightSummary", () => {
  it("returns an empty string when nothing changed price", () => {
    const notes = [
      buildPriceChangeNote(
        "Sertéskaraj",
        "Sertéskaraj",
        "SAJTFUTAR",
        2000,
        { supplier: "SAJTFUTAR", unitPrice: 2000 },
        null
      ),
    ];
    expect(buildHighlightSummary(notes)).toBe("");
  });

  it("uses the short name (not the full product name) and flags a price increase", () => {
    const notes = [
      buildPriceChangeNote(
        "FRISS CSIRKE MELLFILÉ FELEZETT FINOM CSIBE LÉDIG 12 KG/# HU1512EK",
        "Csirkemell",
        "BAROMFIUDVAR",
        1750,
        { supplier: "BAROMFIUDVAR", unitPrice: 1690 },
        null
      ),
    ];
    const highlight = buildHighlightSummary(notes);
    expect(highlight).toContain("Csirkemell ára drágább lett (1690 → 1750 Ft, Baromfiudvarnál)");
    expect(highlight).not.toContain("FRISS CSIRKE MELLFILÉ");
  });

  it("flags a price decrease", () => {
    const notes = [
      buildPriceChangeNote(
        "Tejföl 20% vödrös",
        "Tejföl",
        "BAROMFIUDVAR",
        3299,
        { supplier: "BAROMFIUDVAR", unitPrice: 4799 },
        null
      ),
    ];
    expect(buildHighlightSummary(notes)).toContain("Tejföl ára olcsóbb lett (4799 → 3299 Ft, Baromfiudvarnál)");
  });

  it("only includes items that actually changed price, skipping unchanged ones", () => {
    const notes = [
      buildPriceChangeNote(
        "Csirkemell",
        "Csirkemell",
        "BAROMFIUDVAR",
        1690,
        { supplier: "BAROMFIUDVAR", unitPrice: 1690 },
        null
      ),
      buildPriceChangeNote(
        "Tejföl",
        "Tejföl",
        "BAROMFIUDVAR",
        3299,
        { supplier: "BAROMFIUDVAR", unitPrice: 4799 },
        null
      ),
    ];
    const highlight = buildHighlightSummary(notes);
    expect(highlight).not.toContain("Csirkemell");
    expect(highlight).toContain("Tejföl");
  });
});

describe("processInvoiceLineItems", () => {
  it("matches an existing confirmed product and records the observation", async () => {
    findMany.mockResolvedValue([{ id: "prod-1", name: "Csirke mellfilé" }]);
    findFirst.mockResolvedValueOnce({ supplier: "BAROMFIUDVAR", unitPrice: 1200 });
    findFirst.mockResolvedValueOnce(null);
    observationCreate.mockResolvedValue({});

    const result = await processInvoiceLineItems("inv-1", "BAROMFIUDVAR", {
      invoiceDate: "2026-07-10",
      lineItems: [
        { name: "Csirkemell filé", shortName: "Csirkemell", unit: "kg", quantity: 10, unitPrice: 1350.4 },
      ],
    });

    expect(productCreate).not.toHaveBeenCalled();
    expect(observationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: "prod-1", unitPrice: 1350, supplier: "BAROMFIUDVAR" }),
      })
    );
    expect(result.summaryText).toContain("Csirkemell ára drágább lett (1200 → 1350 Ft, Baromfiudvarnál)");
    expect(result.summaryText).toContain("Csirke mellfilé: 1200 → 1350 Ft");
    expect(result.highlightText).toBe("📈 Csirkemell ára drágább lett (1200 → 1350 Ft, Baromfiudvarnál)");
  });

  it("creates a new pending product when nothing matches", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);
    productCreate.mockResolvedValue({ id: "prod-new", name: "Egzotikus fűszerkeverék" });
    observationCreate.mockResolvedValue({});

    const result = await processInvoiceLineItems("inv-2", "SAJTFUTAR", {
      invoiceDate: null,
      lineItems: [
        { name: "Egzotikus fűszerkeverék", shortName: "Fűszerkeverék", unit: null, quantity: 1, unitPrice: 500 },
      ],
    });

    expect(productCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Egzotikus fűszerkeverék", status: "PENDING" }),
      })
    );
    expect(result.summaryText).toContain("Egzotikus fűszerkeverék: 500 Ft");
    expect(result.highlightText).toBeNull();
  });
});
