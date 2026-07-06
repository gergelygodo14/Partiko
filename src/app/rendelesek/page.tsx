"use client";

import { useEffect, useState } from "react";
import type { OrderDayQuantities } from "@/lib/orders";

type CustomerRow = {
  customerId: string;
  storeName: string;
  companyName: string;
} & OrderDayQuantities;

type Summary = {
  date: string;
  dishNames: { a: string; b: string; c: string } | null;
  dayTotals: OrderDayQuantities;
  byCustomer: CustomerRow[];
  weekTotalMeals: number;
  weekTotalValue: number;
};

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
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

  const dayGrandTotal = summary.dayTotals.a + summary.dayTotals.b + summary.dayTotals.c;

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
                    <td className="px-3 py-3 text-right">{c.a || ""}</td>
                    <td className="px-3 py-3 text-right">{c.b || ""}</td>
                    <td className="px-3 py-3 text-right">{c.c || ""}</td>
                    <td className="px-3 py-3 text-right font-medium">{c.a + c.b + c.c}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 font-semibold">
                  <td className="px-3 py-3">Összesen</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals.a}</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals.b}</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals.c}</td>
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
    </div>
  );
}
