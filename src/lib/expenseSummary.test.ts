import { describe, expect, it } from "vitest";
import { groupInvoicesByMonth, summarizeMonthlyExpenses, type NavLedgerRow } from "@/lib/expenseSummary";

function row(overrides: Partial<NavLedgerRow>): NavLedgerRow {
  return {
    id: "id",
    supplier: "BAROMFIUDVAR",
    navInvoiceNumber: "INV-1",
    issueDate: "2026-09-01",
    netAmountHUF: 1000,
    vatAmountHUF: 270,
    ...overrides,
  };
}

describe("groupInvoicesByMonth", () => {
  it("buckets rows by the invoice's issue month, not upload/creation time", () => {
    const rows = [
      row({ id: "a", issueDate: "2026-09-15" }),
      row({ id: "b", issueDate: "2026-08-20" }),
      row({ id: "c", issueDate: "2026-09-01" }),
    ];

    const groups = groupInvoicesByMonth(rows);

    expect(groups.map((g) => g.month)).toEqual(["2026-09-01", "2026-08-01"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("computes each month's gross (net+VAT) subtotal", () => {
    const rows = [
      row({ id: "a", netAmountHUF: 1000, vatAmountHUF: 270 }),
      row({ id: "b", netAmountHUF: 2000, vatAmountHUF: 540 }),
    ];

    const [group] = groupInvoicesByMonth(rows);

    expect(group.subtotalGrossHUF).toBe(3810);
  });

  it("treats a missing net or VAT amount as 0 rather than poisoning the subtotal", () => {
    const rows = [row({ netAmountHUF: null, vatAmountHUF: null })];

    const [group] = groupInvoicesByMonth(rows);

    expect(group.subtotalGrossHUF).toBe(0);
  });

  it("preserves the incoming month order rather than re-sorting", () => {
    // Caller already sorted newest-first; a second sort here would silently
    // disagree if it ever used a different key.
    const rows = [row({ issueDate: "2026-06-01" }), row({ issueDate: "2026-09-01" })];

    const groups = groupInvoicesByMonth(rows);

    expect(groups.map((g) => g.month)).toEqual(["2026-06-01", "2026-09-01"]);
  });
});

describe("summarizeMonthlyExpenses", () => {
  it("sums net and gross separately per supplier", () => {
    const summary = summarizeMonthlyExpenses([
      { supplier: "BAROMFIUDVAR", netAmountHUF: 1000, vatAmountHUF: 270 },
      { supplier: "BAROMFIUDVAR", netAmountHUF: 500, vatAmountHUF: 135 },
      { supplier: "SAJTFUTAR", netAmountHUF: 2000, vatAmountHUF: 540 },
    ]);

    expect(summary.bySupplier.BAROMFIUDVAR).toEqual({ netHUF: 1500, grossHUF: 1905 });
    expect(summary.bySupplier.SAJTFUTAR).toEqual({ netHUF: 2000, grossHUF: 2540 });
    expect(summary.totalNetHUF).toBe(3500);
    expect(summary.totalGrossHUF).toBe(4445);
    expect(summary.invoiceCount).toBe(3);
  });

  it("returns zeroed totals for an empty month", () => {
    const summary = summarizeMonthlyExpenses([]);

    expect(summary).toEqual({ bySupplier: {}, totalNetHUF: 0, totalGrossHUF: 0, invoiceCount: 0 });
  });

  it("treats a missing net or VAT amount as 0", () => {
    const summary = summarizeMonthlyExpenses([
      { supplier: "SAJTFUTAR", netAmountHUF: null, vatAmountHUF: null },
    ]);

    expect(summary.bySupplier.SAJTFUTAR).toEqual({ netHUF: 0, grossHUF: 0 });
  });
});
