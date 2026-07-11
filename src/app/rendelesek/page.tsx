"use client";

import { useEffect, useState } from "react";
import type { OrderDayQuantities } from "@/lib/orders";

type CustomerRow = {
  customerId: string;
  storeName: string;
  companyName: string;
} & OrderDayQuantities;

type NextWeekCustomerRow = {
  customerId: string;
  storeName: string;
  days: number[];
  total: number;
  value: number;
};

type NextWeekSummary = {
  weekStart: string;
  dayTotals: number[];
  byCustomer: NextWeekCustomerRow[];
  totalMeals: number;
  totalValue: number;
};

type Summary = {
  date: string;
  dishNames: { a: string; b: string; c: string } | null;
  dayTotals: OrderDayQuantities;
  byCustomer: CustomerRow[];
  weekTotalMeals: number;
  weekTotalValue: number;
  nextWeek: NextWeekSummary | null;
};

const SHORT_DAY_NAMES = ["H", "K", "Sze", "Cs", "P"];

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCell(normal: number, xl: number): string {
  if (normal === 0 && xl === 0) return "";
  if (xl === 0) return String(normal);
  if (normal === 0) return `+${xl} XL`;
  return `${normal} (+${xl} XL)`;
}

function dishTotal(q: OrderDayQuantities) {
  return q.a + q.aXl + q.b + q.bXl + q.c + q.cXl;
}

export default function OrdersPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/orders/summary");
      setSummary(await res.json());
      setLoading(false);
    })();
  }, []);

  if (loading || !summary) {
    return <p className="text-neutral-500">Betöltés...</p>;
  }

  const dayGrandTotal = dishTotal(summary.dayTotals);
  // Once ordering has moved on to next week (Thursday 10:00 cutoff), this
  // week's remainder is done and forgotten - the next week's live orders
  // take over the main view instead of just appending below it.
  const nextWeek = summary.nextWeek;

  return (
    <div className="space-y-8">
      <section className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <a
          href="/api/orders/export"
          className="block text-center bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500"
        >
          Holnapi rendelések letöltése (.xlsx)
        </a>
        <p className="text-xs text-neutral-500 text-center">
          Mindig a következő napra (amit ma főzünk) tartalmazza a rendeléseket — nincs hét- vagy
          dátumválasztás, minden nap ugyanez a gomb tölti le a friss listát.
        </p>
      </section>

      {nextWeek ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Következő heti rendelések{" "}
              <span className="text-neutral-400 font-normal text-sm">
                ({formatDate(nextWeek.weekStart)}-tól)
              </span>
            </h2>
            {nextWeek.byCustomer.length === 0 ? (
              <p className="text-neutral-500">Még nincs leadott rendelés a jövő hétre.</p>
            ) : (
              <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="text-left px-3 py-3">Üzlet</th>
                      {SHORT_DAY_NAMES.map((name) => (
                        <th key={name} className="text-right px-3 py-3">
                          {name}
                        </th>
                      ))}
                      <th className="text-right px-3 py-3">Összesen</th>
                      <th className="text-right px-3 py-3">Érték</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextWeek.byCustomer.map((c) => (
                      <tr key={c.customerId} className="border-t border-neutral-100">
                        <td className="px-3 py-3">{c.storeName}</td>
                        {c.days.map((d, i) => (
                          <td key={i} className="px-3 py-3 text-right">
                            {d || ""}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right font-medium">{c.total}</td>
                        <td className="px-3 py-3 text-right font-medium">
                          {c.value.toLocaleString("hu-HU")} Ft
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-neutral-300 font-semibold">
                      <td className="px-3 py-3">Összesen</td>
                      {nextWeek.dayTotals.map((d, i) => (
                        <td key={i} className="px-3 py-3 text-right">
                          {d || ""}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">{nextWeek.totalMeals}</td>
                      <td className="px-3 py-3 text-right">
                        {nextWeek.totalValue.toLocaleString("hu-HU")} Ft
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <h2 className="text-lg font-semibold">Heti összesítés</h2>
            <p className="text-neutral-600">
              A következő héten eddig összesen{" "}
              <span className="font-semibold">{nextWeek.totalMeals.toLocaleString("hu-HU")}</span> kaja
              lett megrendelve.
            </p>
            <p className="text-neutral-600">
              Összeg:{" "}
              <span className="font-semibold">{nextWeek.totalValue.toLocaleString("hu-HU")} Ft</span>
            </p>
          </section>
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Napi összesítés{" "}
              <span className="text-neutral-400 font-normal text-sm">({formatDate(summary.date)})</span>
            </h2>
            {summary.byCustomer.length === 0 ? (
              <p className="text-neutral-500">Nincs leadott rendelés erre a napra.</p>
            ) : (
              <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="text-left px-3 py-3">Üzlet</th>
                      <th className="text-right px-3 py-3">{summary.dishNames?.a ?? "A"}</th>
                      <th className="text-right px-3 py-3">{summary.dishNames?.b ?? "B"}</th>
                      <th className="text-right px-3 py-3">{summary.dishNames?.c ?? "C"}</th>
                      <th className="text-right px-3 py-3">Összesen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCustomer.map((c) => (
                      <tr key={c.customerId} className="border-t border-neutral-100">
                        <td className="px-3 py-3">{c.storeName}</td>
                        <td className="px-3 py-3 text-right">{formatCell(c.a, c.aXl)}</td>
                        <td className="px-3 py-3 text-right">{formatCell(c.b, c.bXl)}</td>
                        <td className="px-3 py-3 text-right">{formatCell(c.c, c.cXl)}</td>
                        <td className="px-3 py-3 text-right font-medium">{dishTotal(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-neutral-300 font-semibold">
                      <td className="px-3 py-3">Összesen</td>
                      <td className="px-3 py-3 text-right">
                        {formatCell(summary.dayTotals.a, summary.dayTotals.aXl)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCell(summary.dayTotals.b, summary.dayTotals.bXl)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCell(summary.dayTotals.c, summary.dayTotals.cXl)}
                      </td>
                      <td className="px-3 py-3 text-right">{dayGrandTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <h2 className="text-lg font-semibold">Heti összesítés</h2>
            <p className="text-neutral-600">
              Ezen a héten összesen{" "}
              <span className="font-semibold">{summary.weekTotalMeals.toLocaleString("hu-HU")}</span> kaja
              lett megrendelve.
            </p>
            <p className="text-neutral-600">
              Összeg:{" "}
              <span className="font-semibold">{summary.weekTotalValue.toLocaleString("hu-HU")} Ft</span>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
