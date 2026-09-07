import { beforeEach, describe, expect, it, vi } from "vitest";

const invoiceFindFirst = vi.fn();
const invoiceCreate = vi.fn();
const invoiceUpdate = vi.fn();
const queryInvoiceDigest = vi.fn();
const queryInvoiceData = vi.fn();
const processInvoiceLineItems = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: {
      findFirst: (...args: unknown[]) => invoiceFindFirst(...args),
      create: (...args: unknown[]) => invoiceCreate(...args),
      update: (...args: unknown[]) => invoiceUpdate(...args),
    },
  },
}));

vi.mock("@/lib/nav", () => ({
  queryInvoiceDigest: (...args: unknown[]) => queryInvoiceDigest(...args),
  queryInvoiceData: (...args: unknown[]) => queryInvoiceData(...args),
}));

vi.mock("@/lib/invoiceProcessing", () => ({
  processInvoiceLineItems: (...args: unknown[]) => processInvoiceLineItems(...args),
}));

const { importNavInvoicesForRange, toExtractedInvoice } = await import("@/lib/navInvoiceIngestion");

beforeEach(() => {
  invoiceFindFirst.mockReset();
  invoiceCreate.mockReset();
  invoiceUpdate.mockReset();
  queryInvoiceDigest.mockReset();
  queryInvoiceData.mockReset();
  processInvoiceLineItems.mockReset();
});

function digestOf(entries: { invoiceNumber: string; supplierTaxNumber: string | null }[]) {
  return {
    invoices: entries.map((e) => ({
      invoiceNumber: e.invoiceNumber,
      invoiceDirection: "INBOUND" as const,
      supplierName: "teszt",
      supplierTaxNumber: e.supplierTaxNumber,
      issueDate: "2026-09-01",
      invoiceNetAmountHUF: 1000,
      invoiceVatAmountHUF: 270,
    })),
    currentPage: 1,
    availablePage: 1,
  };
}

describe("toExtractedInvoice", () => {
  it("maps description/quantity/unit/unitPriceHUF into name/shortName/unit/quantity/unitPrice", () => {
    const result = toExtractedInvoice({
      issueDate: "2026-08-04",
      lines: [{ description: "Csirkemell", quantity: 12, unit: "KILOGRAM", unitPriceHUF: 1759 }],
    });
    expect(result).toEqual({
      invoiceDate: "2026-08-04",
      lineItems: [{ name: "Csirkemell", shortName: "Csirkemell", unit: "KILOGRAM", quantity: 12, unitPrice: 1759 }],
    });
  });

  it("drops a line missing description, quantity, or price", () => {
    const result = toExtractedInvoice({
      issueDate: null,
      lines: [
        { description: null, quantity: 1, unit: "PIECE", unitPriceHUF: 100 },
        { description: "X", quantity: null, unit: "PIECE", unitPriceHUF: 100 },
        { description: "Y", quantity: 1, unit: "PIECE", unitPriceHUF: null },
        { description: "Valid", quantity: 2, unit: null, unitPriceHUF: 50 },
      ],
    });
    expect(result.lineItems).toEqual([
      { name: "Valid", shortName: "Valid", unit: null, quantity: 2, unitPrice: 50 },
    ]);
  });
});

describe("importNavInvoicesForRange", () => {
  it("only imports invoices from the two known suppliers, ignoring others found in the digest", async () => {
    queryInvoiceDigest.mockResolvedValue(
      digestOf([
        { invoiceNumber: "SF-1", supplierTaxNumber: "13833185" }, // SAJTFUTAR
        { invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }, // BAROMFIUDVAR
        { invoiceNumber: "OTHER-1", supplierTaxNumber: "99999999" }, // unmapped
      ])
    );
    invoiceFindFirst.mockResolvedValue(null);
    invoiceCreate.mockImplementation(({ data }) => Promise.resolve({ id: `inv-${data.navInvoiceNumber}` }));
    invoiceUpdate.mockResolvedValue({});
    queryInvoiceData.mockResolvedValue({
      issueDate: "2026-09-01",
      supplierName: "x",
      lines: [{ description: "Tétel", quantity: 1, unit: "PIECE", unitPriceHUF: 100 }],
    });
    processInvoiceLineItems.mockResolvedValue({
      summaryText: "ok",
      highlightText: null,
      pendingLineItems: [],
    });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toHaveLength(2);
    expect(outcomes.map((o) => o.invoiceNumber)).toEqual(["SF-1", "BU-1"]);
    expect(queryInvoiceData).toHaveBeenCalledTimes(2);
  });

  it("skips an invoice already imported (dedup by supplier + navInvoiceNumber)", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([{ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }]));
    invoiceFindFirst.mockResolvedValue({ id: "already-there" });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([{ status: "already_imported", supplier: "BAROMFIUDVAR", invoiceNumber: "BU-1" }]);
    expect(queryInvoiceData).not.toHaveBeenCalled();
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("reports no_usable_lines and does not create an Invoice row when every line is unusable", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([{ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }]));
    invoiceFindFirst.mockResolvedValue(null);
    queryInvoiceData.mockResolvedValue({
      issueDate: "2026-09-01",
      supplierName: "x",
      lines: [{ description: null, quantity: null, unit: null, unitPriceHUF: null }],
    });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([{ status: "no_usable_lines", supplier: "BAROMFIUDVAR", invoiceNumber: "BU-1" }]);
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("passes PriceSource.NAV through to processInvoiceLineItems", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([{ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }]));
    invoiceFindFirst.mockResolvedValue(null);
    invoiceCreate.mockResolvedValue({ id: "inv-1" });
    invoiceUpdate.mockResolvedValue({});
    queryInvoiceData.mockResolvedValue({
      issueDate: "2026-09-01",
      supplierName: "x",
      lines: [{ description: "Tétel", quantity: 1, unit: "PIECE", unitPriceHUF: 100 }],
    });
    processInvoiceLineItems.mockResolvedValue({ summaryText: "ok", highlightText: null, pendingLineItems: [] });

    await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(processInvoiceLineItems).toHaveBeenCalledWith(
      "inv-1",
      "BAROMFIUDVAR",
      expect.objectContaining({ invoiceDate: "2026-09-01" }),
      "NAV"
    );
  });

  it("records an error outcome instead of throwing when queryInvoiceData fails for one invoice", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([{ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }]));
    invoiceFindFirst.mockResolvedValue(null);
    queryInvoiceData.mockRejectedValue(new Error("NAV API hiba"));

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([
      { status: "error", supplier: "BAROMFIUDVAR", invoiceNumber: "BU-1", error: "NAV API hiba" },
    ]);
  });

  it("sweeps every digest page before importing", async () => {
    queryInvoiceDigest.mockImplementation(({ page }: { page: number }) => {
      if (page === 1) {
        return Promise.resolve({
          ...digestOf([{ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }]),
          currentPage: 1,
          availablePage: 2,
        });
      }
      return Promise.resolve({
        ...digestOf([{ invoiceNumber: "BU-2", supplierTaxNumber: "12830093" }]),
        currentPage: 2,
        availablePage: 2,
      });
    });
    invoiceFindFirst.mockResolvedValue({ id: "already-there" }); // short-circuit to keep this test focused on pagination

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(queryInvoiceDigest).toHaveBeenCalledTimes(2);
    expect(outcomes.map((o) => o.invoiceNumber)).toEqual(["BU-1", "BU-2"]);
  });
});
