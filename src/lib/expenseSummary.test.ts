import { describe, expect, it } from "vitest";
import {
  groupInvoicesByMonth,
  summarizeMonthlyExpenses,
  supplierDisplayName,
  type NavLedgerRow,
} from "@/lib/expenseSummary";

function row(overrides: Partial<NavLedgerRow>): NavLedgerRow {
  return {
    id: "id",
    supplier: "BAROMFIUDVAR",
    supplierName: "Baromfiudvar 2002 Kft.",
    navInvoiceNumber: "INV-1",
    issueDate: "2026-09-01",
    netAmountHUF: 1000,
    vatAmountHUF: 270,
    ...overrides,
  };
}

describe("supplierDisplayName", () => {
  it("prefers the app's friendly label for a tracked supplier over NAV's own name", () => {
    expect(
      supplierDisplayName({ supplier: "SAJTFUTAR", supplierName: "SAJT-EXPRESSZ Kft." })
    ).toBe("Sajtfutár");
    expect(
      supplierDisplayName({ supplier: "BAROMFIUDVAR", supplierName: "Baromfiudvar 2002 Kft." })
    ).toBe("Baromfiudvar");
  });

  it("falls back to NAV's raw supplier name for an untracked supplier", () => {
    expect(supplierDisplayName({ supplier: null, supplierName: "MVM Next Zrt." })).toBe("MVM Next Zrt.");
  });

  it("falls back to a placeholder when even the raw name is missing", () => {
    expect(supplierDisplayName({ supplier: null, supplierName: null })).toBe("Ismeretlen beszállító");
  });
});

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

  it("groups ledger-only (untracked-supplier) rows just like tracked ones", () => {
    const rows = [row({ supplier: null, supplierName: "MVM Next Zrt.", issueDate: "2026-09-05" })];

    const groups = groupInvoicesByMonth(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].rows[0].supplierName).toBe("MVM Next Zrt.");
  });
});

describe("summarizeMonthlyExpenses", () => {
  it("sums net and gross separately per supplier, biggest spend first", () => {
    const summary = summarizeMonthlyExpenses([
      { supplier: "BAROMFIUDVAR", supplierName: "Baromfiudvar 2002 Kft.", netAmountHUF: 1000, vatAmountHUF: 270 },
      { supplier: "BAROMFIUDVAR", supplierName: "Baromfiudvar 2002 Kft.", netAmountHUF: 500, vatAmountHUF: 135 },
      { supplier: "SAJTFUTAR", supplierName: "SAJT-EXPRESSZ Kft.", netAmountHUF: 5000, vatAmountHUF: 1350 },
    ]);

    expect(summary.bySupplier).toEqual([
      { name: "Sajtfutár", netHUF: 5000, grossHUF: 6350, invoiceCount: 1 },
      { name: "Baromfiudvar", netHUF: 1500, grossHUF: 1905, invoiceCount: 2 },
    ]);
    expect(summary.totalNetHUF).toBe(6500);
    expect(summary.totalGrossHUF).toBe(8255);
    expect(summary.invoiceCount).toBe(3);
  });

  it("groups an untracked supplier under its raw NAV name, separate from the tracked ones", () => {
    const summary = summarizeMonthlyExpenses([
      { supplier: null, supplierName: "MVM Next Zrt.", netAmountHUF: 10000, vatAmountHUF: 2700 },
      { supplier: "BAROMFIUDVAR", supplierName: "Baromfiudvar 2002 Kft.", netAmountHUF: 1000, vatAmountHUF: 270 },
    ]);

    expect(summary.bySupplier).toEqual([
      { name: "MVM Next Zrt.", netHUF: 10000, grossHUF: 12700, invoiceCount: 1 },
      { name: "Baromfiudvar", netHUF: 1000, grossHUF: 1270, invoiceCount: 1 },
    ]);
  });

  it("returns zeroed totals for an empty month", () => {
    const summary = summarizeMonthlyExpenses([]);

    expect(summary).toEqual({ bySupplier: [], totalNetHUF: 0, totalGrossHUF: 0, invoiceCount: 0 });
  });

  it("treats a missing net or VAT amount as 0", () => {
    const summary = summarizeMonthlyExpenses([
      { supplier: "SAJTFUTAR", supplierName: "SAJT-EXPRESSZ Kft.", netAmountHUF: null, vatAmountHUF: null },
    ]);

    expect(summary.bySupplier).toEqual([{ name: "Sajtfutár", netHUF: 0, grossHUF: 0, invoiceCount: 1 }]);
  });
});
