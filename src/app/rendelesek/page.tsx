"use client";

import { useCallback, useEffect, useState } from "react";
import { addDaysStr } from "@/lib/dates";
import { DAY_NAMES } from "@/lib/weeklyMenu";
import type { OrderDayQuantities, OrderLetter } from "@/lib/orders";

type CustomerRow = {
  customerId: string;
  storeName: string;
  companyName: string;
  days: OrderDayQuantities[];
};

type Summary = {
  weekStart: string;
  dayTotals: OrderDayQuantities[];
  byCustomer: CustomerRow[];
};

const LETTERS = ["a", "b", "c"] as const;
const dayLetterColumns = DAY_NAMES.flatMap((name, dayIndex) =>
  LETTERS.map((letter) => ({ name, dayIndex, letter }))
);

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

export default function OrdersPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (week?: string) => {
    setLoading(true);
    const res = await fetch(`/api/orders/summary${week ? `?week=${week}` : ""}`);
    const data: Summary = await res.json();
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !summary) {
    return <p className="text-neutral-500">Betöltés...</p>;
  }
  if (!summary) return null;

  const { weekStart } = summary;
  const weekEnd = addDaysStr(weekStart, 4);
  const grandTotals = summary.dayTotals.reduce(
    (acc, d) => ({ a: acc.a + d.a, b: acc.b + d.b, c: acc.c + d.c }),
    { a: 0, b: 0, c: 0 }
  );

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

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => load(addDaysStr(weekStart, -7))}
          className="px-4 py-3 rounded-xl border border-neutral-300 active:bg-neutral-100"
          aria-label="Előző hét"
        >
          ←
        </button>
        <div className="font-semibold text-center">
          {formatDate(weekStart)} – {formatDate(weekEnd)}
        </div>
        <button
          onClick={() => load(addDaysStr(weekStart, 7))}
          className="px-4 py-3 rounded-xl border border-neutral-300 active:bg-neutral-100"
          aria-label="Következő hét"
        >
          →
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Napi összesítés</h2>
        <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-3">Nap</th>
                <th className="text-right px-3 py-3">A</th>
                <th className="text-right px-3 py-3">B</th>
                <th className="text-right px-3 py-3">C</th>
              </tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((name, i) => (
                <tr key={name} className="border-t border-neutral-100">
                  <td className="px-3 py-3">{name}</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals[i].a}</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals[i].b}</td>
                  <td className="px-3 py-3 text-right">{summary.dayTotals[i].c}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="px-3 py-3">Összesen</td>
                <td className="px-3 py-3 text-right">{grandTotals.a}</td>
                <td className="px-3 py-3 text-right">{grandTotals.b}</td>
                <td className="px-3 py-3 text-right">{grandTotals.c}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Üzletek szerint</h2>
        {summary.byCustomer.length === 0 ? (
          <p className="text-neutral-500">Nincs leadott rendelés ezen a héten.</p>
        ) : (
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-600">
                <tr>
                  <th className="text-left px-3 py-3" rowSpan={2}>
                    Üzlet
                  </th>
                  {DAY_NAMES.map((name) => (
                    <th key={name} className="text-center px-2 py-2 border-l border-neutral-200" colSpan={3}>
                      {name}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dayLetterColumns.map(({ dayIndex, letter }) => (
                    <th
                      key={`${dayIndex}-${letter}`}
                      className="text-right px-2 py-1 text-xs font-normal"
                    >
                      {letter.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.byCustomer.map((c) => (
                  <tr key={c.customerId} className="border-t border-neutral-100">
                    <td className="px-3 py-3">
                      <div className="font-medium">{c.storeName}</div>
                      <div className="text-xs text-neutral-400">{c.companyName}</div>
                    </td>
                    {dayLetterColumns.map(({ dayIndex, letter }) => {
                      const value = c.days[dayIndex][letter as OrderLetter];
                      return (
                        <td key={`${c.customerId}-${dayIndex}-${letter}`} className="text-right px-2 py-3">
                          {value || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
