import type { Supplier } from "@/generated/prisma/client";

// DB-free grouping/summing logic for the NAV-invoice expense reporting
// (owner request, 2026-09-08): the "Összes számla" ledger on /szamlak and the
// Riportok "Kiadások" card both read from this - only NAV-sourced Invoice
// rows carry netAmountHUF/vatAmountHUF/issueDate (see navInvoiceIngestion.ts),
// so both features are scoped to those, not the older photo-uploaded rows.

export type NavLedgerRow = {
  id: string;
  supplier: Supplier;
  navInvoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  netAmountHUF: number | null;
  vatAmountHUF: number | null;
};

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

export type MonthlyExpenseSummary = {
  bySupplier: Partial<Record<Supplier, { netHUF: number; grossHUF: number }>>;
  totalNetHUF: number;
  totalGrossHUF: number;
  invoiceCount: number;
};

/** Sums a month's worth of NAV invoice rows per supplier, net and gross both
 *  (net for cost analysis, gross - the real cash outflow - as the headline
 *  "kiadás" figure). */
export function summarizeMonthlyExpenses(
  rows: { supplier: Supplier; netAmountHUF: number | null; vatAmountHUF: number | null }[]
): MonthlyExpenseSummary {
  const bySupplier: MonthlyExpenseSummary["bySupplier"] = {};
  for (const row of rows) {
    const net = row.netAmountHUF ?? 0;
    const gross = grossOf(row);
    const existing = bySupplier[row.supplier] ?? { netHUF: 0, grossHUF: 0 };
    bySupplier[row.supplier] = { netHUF: existing.netHUF + net, grossHUF: existing.grossHUF + gross };
  }
  let totalNetHUF = 0;
  let totalGrossHUF = 0;
  for (const v of Object.values(bySupplier)) {
    totalNetHUF += v!.netHUF;
    totalGrossHUF += v!.grossHUF;
  }
  return { bySupplier, totalNetHUF, totalGrossHUF, invoiceCount: rows.length };
}
