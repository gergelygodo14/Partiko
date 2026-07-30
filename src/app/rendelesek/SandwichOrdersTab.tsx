"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDaysStr, addMonthsStr } from "@/lib/dates";
import { FULL_DAY_NAMES, SHORT_DAY_NAMES } from "@/lib/weekdays";

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

type DailyItemTotal = { itemId: string; itemName: string; itemOrder: number; quantity: number };
type DayItemTotals = { date: string; items: DailyItemTotal[] };
type DayBreakdown = { weekStart: string; days: DayItemTotals[] };

type MonthlyItemBreakdown = {
  itemId: string;
  itemName: string;
  itemOrder: number;
  totalQuantity: number;
  byDate: Record<string, number>;
};
type MonthGrid = { monthStart: string; monthEnd: string; businessDays: string[]; items: MonthlyItemBreakdown[] };

type MonthlyItemProfit = {
  itemId: string;
  itemName: string;
  itemOrder: number;
  quantity: number;
  profitPerUnitFt: number;
  totalProfitFt: number;
};
type ProfitReport = { monthStart: string; monthEnd: string; items: MonthlyItemProfit[]; totalProfitFt: number };

type View = "week" | "day" | "monthGrid" | "profit" | "month";

type MeatPrepTotals = {
  rantottHusDb: number;
  tortillaHusDb: number;
  grillHusDkg: number;
};
type MeatPrep = MeatPrepTotals & {
  date: string;
  dayName: string;
  previousWeek: MeatPrepTotals & { date: string; dayName: string };
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
      <p className="text-xs text-neutral-500">
        Előző héten ({meatPrep.previousWeek.dayName} {formatDate(meatPrep.previousWeek.date)}):{" "}
        {meatPrep.previousWeek.rantottHusDb} db rántott hús, {meatPrep.previousWeek.tortillaHusDb} db tortilla hús,{" "}
        {(meatPrep.previousWeek.grillHusDkg / 100).toLocaleString("hu-HU", { maximumFractionDigits: 2 })} kg grill
        hús
      </p>
    </section>
  );
}

function DayItemsTable({ day, dayIndex }: { day: DayItemTotals; dayIndex: number }) {
  const nonZero = day.items.filter((item) => item.quantity > 0);
  const total = nonZero.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {FULL_DAY_NAMES[dayIndex]}{" "}
        <span className="text-neutral-400 font-normal text-sm">({formatDate(day.date)})</span>
      </h2>
      {nonZero.length === 0 ? (
        <p className="text-neutral-500">Nincs leadott szendvics-rendelés erre a napra.</p>
      ) : (
        <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-3">Szendvics</th>
                <th className="text-right px-3 py-3">Db</th>
              </tr>
            </thead>
            <tbody>
              {nonZero.map((item) => (
                <tr key={item.itemId} className="border-t border-neutral-100">
                  <td className="px-3 py-3">{item.itemName}</td>
                  <td className="px-3 py-3 text-right">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="px-3 py-3">Összesen</td>
                <td className="px-3 py-3 text-right">{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function MonthGridTable({ grid }: { grid: MonthGrid }) {
  const dayTotals = grid.businessDays.map((day) =>
    grid.items.reduce((sum, item) => sum + item.byDate[day], 0)
  );
  const grandTotal = grid.items.reduce((sum, item) => sum + item.totalQuantity, 0);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold capitalize">
        Havi bontás{" "}
        <span className="text-neutral-400 font-normal text-sm normal-case">
          ({formatMonthLabel(grid.monthStart)})
        </span>
      </h2>
      {grid.items.every((item) => item.totalQuantity === 0) ? (
        <p className="text-neutral-500">Még nincs leadott szendvics-rendelés erre a hónapra.</p>
      ) : (
        <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="sticky left-0 z-[1] bg-neutral-100 text-left px-3 py-3">Szendvics</th>
                {grid.businessDays.map((day) => (
                  <th key={day} className="text-right px-2 py-3 whitespace-nowrap">
                    {formatDate(day)}
                  </th>
                ))}
                <th className="text-right px-3 py-3 whitespace-nowrap">Összesen</th>
              </tr>
            </thead>
            <tbody>
              {grid.items.map((item) => (
                <tr key={item.itemId} className="border-t border-neutral-100">
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2.5 whitespace-nowrap">
                    {item.itemName}
                  </td>
                  {grid.businessDays.map((day) => (
                    <td key={day} className="text-right px-2 py-2.5">
                      {item.byDate[day]}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2.5 font-medium">{item.totalQuantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="sticky left-0 z-[1] bg-white px-3 py-3">Összesen</td>
                {dayTotals.map((total, i) => (
                  <td key={grid.businessDays[i]} className="text-right px-2 py-3">
                    {total}
                  </td>
                ))}
                <td className="text-right px-3 py-3">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function ProfitTable({ report }: { report: ProfitReport }) {
  const totalQuantity = report.items.reduce((sum, item) => sum + item.quantity, 0);
  const noProfitConfigured = report.items.every((item) => item.profitPerUnitFt === 0);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold capitalize">
        Havi nyereség{" "}
        <span className="text-neutral-400 font-normal text-sm normal-case">
          ({formatMonthLabel(report.monthStart)})
        </span>
      </h2>
      {noProfitConfigured && (
        <p className="text-xs text-amber-600">
          Egyik szendvicshez sincs beállítva haszon, ezért minden érték 0 — állítsd be a{" "}
          <Link href="/rendelesek/szendvics-termekek" className="underline">
            szendvics-katalógusban
          </Link>
          .
        </p>
      )}
      {report.items.every((item) => item.quantity === 0) ? (
        <p className="text-neutral-500">Még nincs leadott szendvics-rendelés erre a hónapra.</p>
      ) : (
        <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-3">Szendvics</th>
                <th className="text-right px-3 py-3">Db</th>
                <th className="text-right px-3 py-3">Haszon/db</th>
                <th className="text-right px-3 py-3">Összesen</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.itemId} className="border-t border-neutral-100">
                  <td className="px-3 py-3">{item.itemName}</td>
                  <td className="px-3 py-3 text-right">{item.quantity}</td>
                  <td className="px-3 py-3 text-right">
                    {item.profitPerUnitFt.toLocaleString("hu-HU")} Ft
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {item.totalProfitFt.toLocaleString("hu-HU")} Ft
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className="px-3 py-3">Összesen</td>
                <td className="px-3 py-3 text-right">{totalQuantity}</td>
                <td></td>
                <td className="px-3 py-3 text-right">
                  {report.totalProfitFt.toLocaleString("hu-HU")} Ft
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <span className="text-neutral-500 text-sm">Havi nyereség összesen</span>
        <span className="font-semibold text-lg">
          {report.totalProfitFt.toLocaleString("hu-HU")} Ft
        </span>
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
  const [dayWeekStart, setDayWeekStart] = useState<string | null>(null);
  const [dayBreakdown, setDayBreakdown] = useState<DayBreakdown | null>(null);
  const [dayBreakdownLoading, setDayBreakdownLoading] = useState(false);
  const [monthGridMonth, setMonthGridMonth] = useState<string | null>(null);
  const [monthGrid, setMonthGrid] = useState<MonthGrid | null>(null);
  const [monthGridLoading, setMonthGridLoading] = useState(false);
  const [profitMonth, setProfitMonth] = useState<string | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const jsWeekday = new Date().getDay(); // 0=Sun..6=Sat
    return Math.min(jsWeekday === 0 ? 6 : jsWeekday - 1, 4);
  });

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

  // Defaults the browsable week to the current one once it's known - can't
  // seed useState with it directly since weekSummary isn't loaded yet on the
  // first render.
  useEffect(() => {
    if (weekSummary && dayWeekStart === null) setDayWeekStart(weekSummary.weekStart);
  }, [weekSummary, dayWeekStart]);

  // Re-fetches on every week-arrow click (not just the first time the tab
  // opens) - the data is tiny and this keeps the logic simple, no caching
  // needed for an internal admin panel.
  useEffect(() => {
    if (view !== "day" || !dayWeekStart) return;
    setDayBreakdownLoading(true);
    (async () => {
      const res = await fetch(`/api/sandwich-orders/day-breakdown?week=${dayWeekStart}`);
      setDayBreakdown(await res.json());
      setDayBreakdownLoading(false);
    })();
  }, [view, dayWeekStart]);

  // Same "default once known, then re-fetch on every nav click" pattern as
  // the weekly day-breakdown above, one level up (months instead of weeks).
  useEffect(() => {
    if (weekSummary && monthGridMonth === null) setMonthGridMonth(weekSummary.weekStart);
  }, [weekSummary, monthGridMonth]);

  useEffect(() => {
    if (view !== "monthGrid" || !monthGridMonth) return;
    setMonthGridLoading(true);
    (async () => {
      const res = await fetch(`/api/sandwich-orders/monthly-item-breakdown?month=${monthGridMonth}`);
      setMonthGrid(await res.json());
      setMonthGridLoading(false);
    })();
  }, [view, monthGridMonth]);

  // Same pattern again, independent month-browsing state from the item x
  // day grid above - navigating one doesn't move the other.
  useEffect(() => {
    if (weekSummary && profitMonth === null) setProfitMonth(weekSummary.weekStart);
  }, [weekSummary, profitMonth]);

  useEffect(() => {
    if (view !== "profit" || !profitMonth) return;
    setProfitLoading(true);
    (async () => {
      const res = await fetch(`/api/sandwich-orders/monthly-profit?month=${profitMonth}`);
      setProfitReport(await res.json());
      setProfitLoading(false);
    })();
  }, [view, profitMonth]);

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

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setView("week")}
          className={`flex-1 min-w-[45%] px-4 py-3 rounded-xl font-semibold text-base ${
            view === "week"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Heti összesítés
        </button>
        <button
          onClick={() => setView("day")}
          className={`flex-1 min-w-[45%] px-4 py-3 rounded-xl font-semibold text-base ${
            view === "day"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Napi bontás
        </button>
        <button
          onClick={() => setView("monthGrid")}
          className={`flex-1 min-w-[45%] px-4 py-3 rounded-xl font-semibold text-base ${
            view === "monthGrid"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Havi bontás
        </button>
        <button
          onClick={() => setView("profit")}
          className={`flex-1 min-w-[45%] px-4 py-3 rounded-xl font-semibold text-base ${
            view === "profit"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Havi nyereség
        </button>
        <button
          onClick={() => setView("month")}
          className={`flex-1 min-w-[45%] px-4 py-3 rounded-xl font-semibold text-base ${
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
      ) : view === "day" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => dayWeekStart && setDayWeekStart(addDaysStr(dayWeekStart, -7))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              ◀ Előző hét
            </button>
            <span className="text-sm text-neutral-500">
              {dayWeekStart &&
                `${formatDate(dayWeekStart)} – ${formatDate(addDaysStr(dayWeekStart, 4))}`}
            </span>
            <button
              onClick={() => dayWeekStart && setDayWeekStart(addDaysStr(dayWeekStart, 7))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              Következő hét ▶
            </button>
          </div>

          <div className="flex gap-1.5">
            {FULL_DAY_NAMES.map((name, i) => (
              <button
                key={name}
                onClick={() => setSelectedDayIndex(i)}
                className={`flex-1 px-1 py-2.5 rounded-xl font-semibold text-sm ${
                  selectedDayIndex === i
                    ? "bg-yellow-400 text-black"
                    : "border border-neutral-300 active:bg-neutral-100"
                }`}
              >
                {SHORT_DAY_NAMES[i]}
              </button>
            ))}
          </div>

          {dayBreakdownLoading || !dayBreakdown ? (
            <p className="text-neutral-500">Betöltés...</p>
          ) : (
            <DayItemsTable day={dayBreakdown.days[selectedDayIndex]} dayIndex={selectedDayIndex} />
          )}
        </>
      ) : view === "monthGrid" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => monthGridMonth && setMonthGridMonth(addMonthsStr(monthGridMonth, -1))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              ◀ Előző hónap
            </button>
            <span className="text-sm text-neutral-500 capitalize">
              {monthGridMonth && formatMonthLabel(monthGridMonth)}
            </span>
            <button
              onClick={() => monthGridMonth && setMonthGridMonth(addMonthsStr(monthGridMonth, 1))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              Következő hónap ▶
            </button>
          </div>

          {monthGridLoading || !monthGrid ? (
            <p className="text-neutral-500">Betöltés...</p>
          ) : (
            <MonthGridTable grid={monthGrid} />
          )}
        </>
      ) : view === "profit" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => profitMonth && setProfitMonth(addMonthsStr(profitMonth, -1))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              ◀ Előző hónap
            </button>
            <span className="text-sm text-neutral-500 capitalize">
              {profitMonth && formatMonthLabel(profitMonth)}
            </span>
            <button
              onClick={() => profitMonth && setProfitMonth(addMonthsStr(profitMonth, 1))}
              className="px-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold active:bg-neutral-100"
            >
              Következő hónap ▶
            </button>
          </div>

          {profitLoading || !profitReport ? (
            <p className="text-neutral-500">Betöltés...</p>
          ) : (
            <ProfitTable report={profitReport} />
          )}
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
