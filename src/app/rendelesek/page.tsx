"use client";

import { useEffect, useState } from "react";
import { formatCell, type OrderDayQuantities } from "@/lib/orders";

type CustomerRow = {
  customerId: string;
  storeName: string;
  companyName: string;
} & OrderDayQuantities;

type WeekCustomerRow = {
  customerId: string;
  storeName: string;
  days: number[];
  total: number;
  value: number;
};

type DaySummary = {
  date: string;
  dishNames: { a: string; b: string; c: string } | null;
  dayTotals: OrderDayQuantities;
  byCustomer: CustomerRow[];
};

type WeekSummary = {
  weekStart: string;
  dayTotals: number[];
  byCustomer: WeekCustomerRow[];
  totalMeals: number;
  totalValue: number;
};

type Summary = {
  day: DaySummary;
  week: WeekSummary;
};

type View = "week" | "day";

const SHORT_DAY_NAMES = ["H", "K", "Sze", "Cs", "P"];

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

function dishTotal(q: OrderDayQuantities) {
  return q.a + q.aXl + q.b + q.bXl + q.c + q.cXl;
}

export default function OrdersPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("week");

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

  const { day, week } = summary;
  const dayGrandTotal = dishTotal(day.dayTotals);

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

      <div className="flex gap-2">
        <button
          onClick={() => setView("week")}
          className={`flex-1 px-4 py-3 rounded-xl font-semibold text-base ${
            view === "week"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Heti összesítés
        </button>
        <button
          onClick={() => setView("day")}
          className={`flex-1 px-4 py-3 rounded-xl font-semibold text-base ${
            view === "day"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Holnapi összesítés
        </button>
      </div>

      {view === "week" ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Heti rendelések{" "}
              <span className="text-neutral-400 font-normal text-sm">
                ({formatDate(week.weekStart)}-tól)
              </span>
            </h2>
            {week.byCustomer.length === 0 ? (
              <p className="text-neutral-500">Még nincs leadott rendelés erre a hétre.</p>
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
                    {week.byCustomer.map((c) => (
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
                      {week.dayTotals.map((d, i) => (
                        <td key={i} className="px-3 py-3 text-right">
                          {d || ""}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right">{week.totalMeals}</td>
                      <td className="px-3 py-3 text-right">
                        {week.totalValue.toLocaleString("hu-HU")} Ft
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
              Ezen a héten eddig összesen{" "}
              <span className="font-semibold">{week.totalMeals.toLocaleString("hu-HU")}</span> kaja
              lett megrendelve.
            </p>
            <p className="text-neutral-600">
              Összeg:{" "}
              <span className="font-semibold">{week.totalValue.toLocaleString("hu-HU")} Ft</span>
            </p>
          </section>
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Napi összesítés{" "}
              <span className="text-neutral-400 font-normal text-sm">({formatDate(day.date)})</span>
            </h2>
            {day.byCustomer.length === 0 ? (
              <p className="text-neutral-500">Nincs leadott rendelés erre a napra.</p>
            ) : (
              <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="text-left px-3 py-3">Üzlet</th>
                      <th className="text-right px-3 py-3">{day.dishNames?.a ?? "A"}</th>
                      <th className="text-right px-3 py-3">{day.dishNames?.b ?? "B"}</th>
                      <th className="text-right px-3 py-3">{day.dishNames?.c ?? "C"}</th>
                      <th className="text-right px-3 py-3">Összesen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.byCustomer.map((c) => (
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
                        {formatCell(day.dayTotals.a, day.dayTotals.aXl)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCell(day.dayTotals.b, day.dayTotals.bXl)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCell(day.dayTotals.c, day.dayTotals.cXl)}
                      </td>
                      <td className="px-3 py-3 text-right">{dayGrandTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
