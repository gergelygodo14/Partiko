"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ItemTotal = { itemId: string; itemName: string; quantity: number; valueFt: number };
type CustomerTotal = { customerId: string; storeName: string; quantity: number; valueFt: number };

type PeriodSummary = {
  byItem: ItemTotal[];
  byCustomer: CustomerTotal[];
  totalQuantity: number;
  totalValueFt: number;
};

type WeekSummary = PeriodSummary & { weekStart: string; weekEnd: string };
type MonthSummary = PeriodSummary & { monthStart: string; monthEnd: string };

type View = "week" | "month";

type MeatPrep = {
  date: string;
  dayName: string;
  rantottHusDb: number;
  tortillaHusDb: number;
  grillHusDkg: number;
};

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMonthLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
  });
}

function SummaryTables({ summary }: { summary: PeriodSummary }) {
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Boltonként</h2>
        {summary.byCustomer.length === 0 ? (
          <p className="text-neutral-500">Még nincs leadott szendvics-rendelés erre az időszakra.</p>
        ) : (
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-600">
                <tr>
                  <th className="text-left px-3 py-3">Üzlet</th>
                  <th className="text-right px-3 py-3">Db</th>
                  <th className="text-right px-3 py-3">Érték</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCustomer.map((c) => (
                  <tr key={c.customerId} className="border-t border-neutral-100">
                    <td className="px-3 py-3">{c.storeName}</td>
                    <td className="px-3 py-3 text-right">{c.quantity}</td>
                    <td className="px-3 py-3 text-right font-medium">
                      {c.valueFt.toLocaleString("hu-HU")} Ft
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-300 font-semibold">
                  <td className="px-3 py-3">Összesen</td>
                  <td className="px-3 py-3 text-right">{summary.totalQuantity}</td>
                  <td className="px-3 py-3 text-right">
                    {summary.totalValueFt.toLocaleString("hu-HU")} Ft
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Szendvicsenként</h2>
        {summary.byItem.length === 0 ? (
          <p className="text-neutral-500">Még nincs leadott szendvics-rendelés erre az időszakra.</p>
        ) : (
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-600">
                <tr>
                  <th className="text-left px-3 py-3">Szendvics</th>
                  <th className="text-right px-3 py-3">Db</th>
                  <th className="text-right px-3 py-3">Érték</th>
                </tr>
              </thead>
              <tbody>
                {summary.byItem.map((item) => (
                  <tr key={item.itemId} className="border-t border-neutral-100">
                    <td className="px-3 py-3">{item.itemName}</td>
                    <td className="px-3 py-3 text-right">{item.quantity}</td>
                    <td className="px-3 py-3 text-right font-medium">
                      {item.valueFt.toLocaleString("hu-HU")} Ft
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function MeatPrepSection({ meatPrep }: { meatPrep: MeatPrep }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Húsigény{" "}
        <span className="text-neutral-400 font-normal text-sm">
          ({meatPrep.dayName} {formatDate(meatPrep.date)})
        </span>
      </h2>
      <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm grid grid-cols-3 divide-x divide-neutral-100">
        <div className="p-4 text-center">
          <div className="text-2xl font-semibold">{meatPrep.rantottHusDb}</div>
          <div className="text-xs text-neutral-500 mt-1">db rántott hús</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-semibold">{meatPrep.tortillaHusDb}</div>
          <div className="text-xs text-neutral-500 mt-1">db tortilla hús</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-semibold">
            {(meatPrep.grillHusDkg / 100).toLocaleString("hu-HU", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 mt-1">kg grill hús</div>
        </div>
      </div>
    </section>
  );
}

export default function SandwichOrdersTab() {
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("week");
  const [downloading, setDownloading] = useState(false);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [meatPrep, setMeatPrep] = useState<MeatPrep | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sandwich-orders/summary");
      setWeekSummary(await res.json());
      setLoading(false);
    })();
    (async () => {
      const res = await fetch("/api/sandwich-orders/tomorrow-meat-prep");
      setMeatPrep(await res.json());
    })();
  }, []);

  useEffect(() => {
    if (view !== "month" || monthSummary || monthLoading) return;
    setMonthLoading(true);
    (async () => {
      const res = await fetch("/api/sandwich-orders/monthly-summary");
      setMonthSummary(await res.json());
      setMonthLoading(false);
    })();
  }, [view, monthSummary, monthLoading]);

  // Same blob-download pattern as the ready-meal export - required because
  // the app runs as an iOS home-screen PWA, where a plain <a href> would
  // navigate the whole app away with no way back.
  async function downloadFile(apiPath: string) {
    setDownloading(true);
    try {
      const res = await fetch(apiPath);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "szendvics.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !weekSummary) {
    return <p className="text-neutral-500">Betöltés...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <button
          onClick={() => downloadFile("/api/sandwich-orders/export")}
          disabled={downloading}
          className="block w-full text-center bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500 disabled:opacity-50"
        >
          {downloading ? "Letöltés…" : "Holnapi szendvics rendelések letöltése (.xlsx)"}
        </button>
        <p className="text-xs text-neutral-500 text-center">
          Mindig a következő napra tartalmazza a rendeléseket, boltonként oszlopban, szendvicsenként
          sorban.
        </p>
        <button
          onClick={() => downloadFile("/api/sandwich-orders/daily-summary-export")}
          disabled={downloading}
          className="block w-full text-center border border-neutral-300 font-semibold text-base px-5 py-3 rounded-xl active:bg-neutral-100 disabled:opacity-50"
        >
          {downloading ? "Letöltés…" : "Holnapi szendvics összesítő letöltése (.xlsx)"}
        </button>
        <p className="text-xs text-neutral-500 text-center">
          Csak szendvicsenkénti darabszám, boltok nélkül - a rendelések excel "összesítés" fülének
          formátumában.
        </p>
        <Link
          href="/rendelesek/szendvics-termekek"
          className="block text-center text-sm text-neutral-500 underline"
        >
          Szendvics-katalógus szerkesztése
        </Link>
      </section>

      {meatPrep && <MeatPrepSection meatPrep={meatPrep} />}

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
          onClick={() => setView("month")}
          className={`flex-1 px-4 py-3 rounded-xl font-semibold text-base ${
            view === "month"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Havi elszámolás
        </button>
      </div>

      {view === "week" ? (
        <>
          <h2 className="text-lg font-semibold">
            Heti szendvics rendelések{" "}
            <span className="text-neutral-400 font-normal text-sm">
              ({formatDate(weekSummary.weekStart)} – {formatDate(weekSummary.weekEnd)})
            </span>
          </h2>
          <SummaryTables summary={weekSummary} />
        </>
      ) : monthLoading || !monthSummary ? (
        <p className="text-neutral-500">Betöltés...</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold capitalize">
            Havi szendvics elszámolás{" "}
            <span className="text-neutral-400 font-normal text-sm normal-case">
              ({formatMonthLabel(monthSummary.monthStart)})
            </span>
          </h2>
          <SummaryTables summary={monthSummary} />
        </>
      )}
    </div>
  );
}
