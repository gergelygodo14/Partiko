import type { Supplier } from "@/generated/prisma/client";

// DB-free grouping/summing logic for the NAV-invoice expense reporting
// (owner request, 2026-09-08): the "Összes számla" ledger on /szamlak and the
// Riportok "Kiadások" card both read from this - only NAV-sourced Invoice
// rows carry netAmountHUF/vatAmountHUF/issueDate (see navInvoiceIngestion.ts),
// so both features are scoped to those, not the older photo-uploaded rows.
// Covers EVERY incoming NAV invoice, not just the 2 price-tracked suppliers
// (owner request, 2026-09-08 - "ne csak baromfit és sajtfutárt mutassa").

export type NavLedgerRow = {
  id: string;
  supplier: Supplier | null;
  supplierName: string | null;
  navInvoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  netAmountHUF: number | null;
  vatAmountHUF: number | null;
};

// The app's own friendly label for the 2 price-tracked suppliers, matching
// how they're named everywhere else (Feldolgozási napló, ár-összehasonlítás)
// - preferred over NAV's own (often the registered legal name, e.g.
// "SAJT-EXPRESSZ Kft." for what the owner calls "Sajtfutár") wherever we
// know which of the two a row belongs to.
const TRACKED_SUPPLIER_LABEL: Record<Supplier, string> = {
  SAJTFUTAR: "Sajtfutár",
  BAROMFIUDVAR: "Baromfiudvar",
};

/** Display name for a ledger row: the app's friendly label for a tracked
 *  supplier, NAV's own raw name for everyone else. */
export function supplierDisplayName(row: { supplier: Supplier | null; supplierName: string | null }): string {
  if (row.supplier) return TRACKED_SUPPLIER_LABEL[row.supplier];
  return row.supplierName ?? "Ismeretlen beszállító";
}

/** "Kiadás" (expense) means what actually left the bank account - gross,
 *  net+VAT - not the net cost-of-goods figure used elsewhere in the app.
 *  Missing amounts count as 0 rather than poisoning the sum with NaN/null;
 *  shouldn't happen for a real NAV row, but the columns are nullable. */
function grossOf(row: { netAmountHUF: number | null; vatAmountHUF: number | null }): number {
  return (row.netAmountHUF ?? 0) + (row.vatAmountHUF ?? 0);
}

export type MonthGroup = {
  month: string; // YYYY-MM-01
  rows: NavLedgerRow[];
  subtotalGrossHUF: number;
};

/** Groups ledger rows into calendar months by issueDate, preserving each
 *  month's incoming row order (caller sorts, e.g. issueDate desc) and the
 *  months' own first-seen order - so a caller that already sorted rows
 *  newest-first gets months back newest-first too, without a second sort
 *  here that could disagree with the caller's ordering. */
export function groupInvoicesByMonth(rows: NavLedgerRow[]): MonthGroup[] {
  const buckets = new Map<string, NavLedgerRow[]>();
  const order: string[] = [];
  for (const row of rows) {
    const month = `${row.issueDate.slice(0, 7)}-01`;
    if (!buckets.has(month)) {
      buckets.set(month, []);
      order.push(month);
    }
    buckets.get(month)!.push(row);
  }
  return order.map((month) => {
    const monthRows = buckets.get(month)!;
    return {
      month,
      rows: monthRows,
      subtotalGrossHUF: monthRows.reduce((sum, r) => sum + grossOf(r), 0),
    };
  });
}

export type SupplierExpenseRow = { name: string; netHUF: number; grossHUF: number; invoiceCount: number };

export type MonthlyExpenseSummary = {
  // Sorted by grossHUF, biggest spend first - a plain list (not keyed by the
  // 2-value Supplier enum) since the scope is now every supplier NAV reports,
  // potentially dozens of distinct names.
  bySupplier: SupplierExpenseRow[];
  totalNetHUF: number;
  totalGrossHUF: number;
  invoiceCount: number;
};

/** Sums a month's worth of NAV invoice rows per supplier (by display name,
 *  see supplierDisplayName), net and gross both - net for cost analysis,
 *  gross - the real cash outflow - as the headline "kiadás" figure. */
export function summarizeMonthlyExpenses(
  rows: {
    supplier: Supplier | null;
    supplierName: string | null;
    netAmountHUF: number | null;
    vatAmountHUF: number | null;
  }[]
): MonthlyExpenseSummary {
  const bySupplierMap = new Map<string, { netHUF: number; grossHUF: number; invoiceCount: number }>();
  for (const row of rows) {
    const name = supplierDisplayName(row);
    const net = row.netAmountHUF ?? 0;
    const gross = grossOf(row);
    const existing = bySupplierMap.get(name) ?? { netHUF: 0, grossHUF: 0, invoiceCount: 0 };
    bySupplierMap.set(name, {
      netHUF: existing.netHUF + net,
      grossHUF: existing.grossHUF + gross,
      invoiceCount: existing.invoiceCount + 1,
    });
  }

  const bySupplier = [...bySupplierMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.grossHUF - a.grossHUF);

  let totalNetHUF = 0;
  let totalGrossHUF = 0;
  for (const row of bySupplier) {
    totalNetHUF += row.netHUF;
    totalGrossHUF += row.grossHUF;
  }
  return { bySupplier, totalNetHUF, totalGrossHUF, invoiceCount: rows.length };
}
