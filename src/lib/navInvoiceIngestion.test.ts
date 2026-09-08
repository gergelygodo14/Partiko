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

const { importNavInvoicesForRange, splitDateRangeIntoChunks, toExtractedInvoice } = await import(
  "@/lib/navInvoiceIngestion"
);

beforeEach(() => {
  invoiceFindFirst.mockReset();
  invoiceCreate.mockReset();
  invoiceUpdate.mockReset();
  queryInvoiceDigest.mockReset();
  queryInvoiceData.mockReset();
  processInvoiceLineItems.mockReset();
});

function digestEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    invoiceNumber: "INV-1",
    invoiceDirection: "INBOUND" as const,
    supplierName: "teszt",
    supplierTaxNumber: "12830093",
    issueDate: "2026-09-01",
    invoiceNetAmountHUF: 1000,
    invoiceVatAmountHUF: 270,
    ...overrides,
  };
}

function digestOf(entries: ReturnType<typeof digestEntry>[]) {
  return { invoices: entries, currentPage: 1, availablePage: 1 };
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

describe("splitDateRangeIntoChunks", () => {
  it("keeps a single-day range as one chunk", () => {
    expect(splitDateRangeIntoChunks("2026-09-01", "2026-09-01")).toEqual([
      { from: "2026-09-01", to: "2026-09-01" },
    ]);
  });

  it("keeps an exactly-35-day range as one chunk", () => {
    const chunks = splitDateRangeIntoChunks("2026-01-01", "2026-02-04"); // 35 days inclusive
    expect(chunks).toEqual([{ from: "2026-01-01", to: "2026-02-04" }]);
  });

  it("splits a 36-day range into two chunks", () => {
    const chunks = splitDateRangeIntoChunks("2026-01-01", "2026-02-05");
    expect(chunks).toEqual([
      { from: "2026-01-01", to: "2026-02-04" },
      { from: "2026-02-05", to: "2026-02-05" },
    ]);
  });

  it("splits a wide multi-month range into consecutive, non-overlapping chunks covering the whole range", () => {
    const chunks = splitDateRangeIntoChunks("2026-01-01", "2026-09-08");
    expect(chunks[0].from).toBe("2026-01-01");
    expect(chunks[chunks.length - 1].to).toBe("2026-09-08");
    for (let i = 1; i < chunks.length; i++) {
      // Consecutive, no gap and no overlap.
      const prevEnd = new Date(`${chunks[i - 1].to}T00:00:00Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
      expect(chunks[i].from).toBe(prevEnd.toISOString().slice(0, 10));
    }
  });
});

describe("importNavInvoicesForRange", () => {
  it("runs the full pipeline for a tracked supplier", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([digestEntry({ invoiceNumber: "BU-1" })]));
    invoiceFindFirst.mockResolvedValue(null);
    invoiceCreate.mockResolvedValue({ id: "inv-1" });
    invoiceUpdate.mockResolvedValue({});
    queryInvoiceData.mockResolvedValue({
      issueDate: "2026-09-01",
      supplierName: "x",
      lines: [{ description: "Tétel", quantity: 1, unit: "PIECE", unitPriceHUF: 100 }],
    });
    processInvoiceLineItems.mockResolvedValue({ summaryText: "ok", highlightText: null, pendingLineItems: [] });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([{ status: "imported", supplier: "BAROMFIUDVAR", invoiceNumber: "BU-1", lineCount: 1 }]);
    expect(queryInvoiceData).toHaveBeenCalledTimes(1);
    expect(processInvoiceLineItems).toHaveBeenCalledWith(
      "inv-1",
      "BAROMFIUDVAR",
      expect.objectContaining({ invoiceDate: "2026-09-01" }),
      "NAV"
    );
  });

  // 2026-09-08 owner request: "Összes számla" must list every incoming
  // invoice, not just the 2 price-tracked suppliers - an unmapped supplier
  // now gets a lightweight ledger row instead of being silently dropped.
  it("records a ledger-only row for a supplier outside the tracked scope, without calling queryInvoiceData", async () => {
    queryInvoiceDigest.mockResolvedValue(
      digestOf([
        digestEntry({ invoiceNumber: "OTHER-1", supplierTaxNumber: "99999999", supplierName: "MVM Next Zrt." }),
      ])
    );
    invoiceFindFirst.mockResolvedValue(null);
    invoiceCreate.mockResolvedValue({ id: "inv-1" });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([
      { status: "ledger_only", supplier: null, supplierName: "MVM Next Zrt.", invoiceNumber: "OTHER-1" },
    ]);
    expect(queryInvoiceData).not.toHaveBeenCalled();
    expect(processInvoiceLineItems).not.toHaveBeenCalled();
    expect(invoiceCreate).toHaveBeenCalledWith({
      data: {
        supplier: null,
        supplierTaxNumber: "99999999",
        supplierName: "MVM Next Zrt.",
        navInvoiceNumber: "OTHER-1",
        status: "PROCESSED",
        processedAt: expect.any(Date),
        issueDate: new Date("2026-09-01"),
        netAmountHUF: 1000,
        vatAmountHUF: 270,
      },
    });
  });

  it("imports both tracked and untracked suppliers found in the same digest", async () => {
    queryInvoiceDigest.mockResolvedValue(
      digestOf([
        digestEntry({ invoiceNumber: "SF-1", supplierTaxNumber: "13833185" }), // SAJTFUTAR
        digestEntry({ invoiceNumber: "BU-1", supplierTaxNumber: "12830093" }), // BAROMFIUDVAR
        digestEntry({ invoiceNumber: "OTHER-1", supplierTaxNumber: "99999999" }), // unmapped
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
    processInvoiceLineItems.mockResolvedValue({ summaryText: "ok", highlightText: null, pendingLineItems: [] });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map((o) => o.status)).toEqual(["imported", "imported", "ledger_only"]);
    expect(queryInvoiceData).toHaveBeenCalledTimes(2); // only the 2 tracked suppliers
  });

  it("skips an invoice already imported (dedup by supplierTaxNumber + navInvoiceNumber)", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([digestEntry({ invoiceNumber: "BU-1" })]));
    invoiceFindFirst.mockResolvedValue({ id: "already-there" });

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([{ status: "already_imported", invoiceNumber: "BU-1" }]);
    expect(invoiceFindFirst).toHaveBeenCalledWith({
      where: { navInvoiceNumber: "BU-1", supplierTaxNumber: "12830093" },
      select: { id: true },
    });
    expect(queryInvoiceData).not.toHaveBeenCalled();
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("reports no_usable_lines and does not create an Invoice row when every line is unusable", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([digestEntry({ invoiceNumber: "BU-1" })]));
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

  it("carries the digest's net/vat amounts and the invoice's issueDate onto the created row", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([digestEntry({ invoiceNumber: "BU-1" })]));
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

    expect(invoiceCreate).toHaveBeenCalledWith({
      data: {
        supplier: "BAROMFIUDVAR",
        supplierTaxNumber: "12830093",
        supplierName: "teszt",
        navInvoiceNumber: "BU-1",
        status: "PROCESSING",
        issueDate: new Date("2026-09-01"),
        netAmountHUF: 1000,
        vatAmountHUF: 270,
      },
    });
  });

  it("records an error outcome instead of throwing when queryInvoiceData fails for one invoice", async () => {
    queryInvoiceDigest.mockResolvedValue(
      digestOf([digestEntry({ invoiceNumber: "BU-1", supplierName: "Baromfiudvar 2002 Kft." })])
    );
    invoiceFindFirst.mockResolvedValue(null);
    queryInvoiceData.mockRejectedValue(new Error("NAV API hiba"));

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(outcomes).toEqual([
      {
        status: "error",
        supplierName: "Baromfiudvar 2002 Kft.",
        invoiceNumber: "BU-1",
        error: "NAV API hiba",
      },
    ]);
  });

  it("sweeps every digest page before importing", async () => {
    queryInvoiceDigest.mockImplementation(({ page }: { page: number }) => {
      if (page === 1) {
        return Promise.resolve({
          ...digestOf([digestEntry({ invoiceNumber: "BU-1" })]),
          currentPage: 1,
          availablePage: 2,
        });
      }
      return Promise.resolve({
        ...digestOf([digestEntry({ invoiceNumber: "BU-2" })]),
        currentPage: 2,
        availablePage: 2,
      });
    });
    invoiceFindFirst.mockResolvedValue({ id: "already-there" }); // short-circuit to keep this test focused on pagination

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01");

    expect(queryInvoiceDigest).toHaveBeenCalledTimes(2);
    expect(outcomes.map((o) => o.invoiceNumber)).toEqual(["BU-1", "BU-2"]);
  });

  it("processes invoices oldest-issueDate-first, regardless of the digest's own order", async () => {
    queryInvoiceDigest.mockResolvedValue(
      digestOf([
        digestEntry({ invoiceNumber: "NEWER", issueDate: "2026-09-05" }),
        digestEntry({ invoiceNumber: "OLDER", issueDate: "2026-09-01" }),
      ])
    );
    invoiceFindFirst.mockResolvedValue({ id: "already-there" }); // short-circuit, focus on ordering

    const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-05");

    expect(outcomes.map((o) => o.invoiceNumber)).toEqual(["OLDER", "NEWER"]);
  });

  it("queries a wide range in multiple <=35-day chunks", async () => {
    queryInvoiceDigest.mockResolvedValue(digestOf([]));

    await importNavInvoicesForRange("2026-01-01", "2026-09-08");

    // 2026-01-01 .. 2026-09-08 is more than 35 days, so more than one chunk.
    expect(queryInvoiceDigest.mock.calls.length).toBeGreaterThan(1);
  });

  // 2026-09-08: used for historical backfills, so a re-run doesn't duplicate
  // PriceObservation rows the photo-upload pipeline already created for the
  // same real invoices before the NAV integration existed.
  describe("ledgerOnly option", () => {
    it("forces even a tracked supplier through the ledger-only path, skipping queryInvoiceData and price analysis", async () => {
      queryInvoiceDigest.mockResolvedValue(digestOf([digestEntry({ invoiceNumber: "BU-1" })]));
      invoiceFindFirst.mockResolvedValue(null);
      invoiceCreate.mockResolvedValue({ id: "inv-1" });

      const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01", { ledgerOnly: true });

      expect(outcomes).toEqual([
        { status: "ledger_only", supplier: "BAROMFIUDVAR", supplierName: "teszt", invoiceNumber: "BU-1" },
      ]);
      expect(queryInvoiceData).not.toHaveBeenCalled();
      expect(processInvoiceLineItems).not.toHaveBeenCalled();
      expect(invoiceCreate).toHaveBeenCalledWith({
        data: {
          supplier: "BAROMFIUDVAR",
          supplierTaxNumber: "12830093",
          supplierName: "teszt",
          navInvoiceNumber: "BU-1",
          status: "PROCESSED",
          processedAt: expect.any(Date),
          issueDate: new Date("2026-09-01"),
          netAmountHUF: 1000,
          vatAmountHUF: 270,
        },
      });
    });

    it("still ledger-imports an untracked supplier normally when ledgerOnly is set", async () => {
      queryInvoiceDigest.mockResolvedValue(
        digestOf([digestEntry({ invoiceNumber: "OTHER-1", supplierTaxNumber: "99999999" })])
      );
      invoiceFindFirst.mockResolvedValue(null);
      invoiceCreate.mockResolvedValue({ id: "inv-1" });

      const outcomes = await importNavInvoicesForRange("2026-09-01", "2026-09-01", { ledgerOnly: true });

      expect(outcomes).toEqual([
        { status: "ledger_only", supplier: null, supplierName: "teszt", invoiceNumber: "OTHER-1" },
      ]);
    });
  });
});
