"use client";

import { useCallback, useEffect, useState } from "react";

type SummaryRow = {
  ingredientId: string;
  name: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalValue: number;
};

type Summary = { rows: SummaryRow[]; grandTotal: number };

type BillingPeriod = {
  id: string;
  from: string;
  to: string;
  closedAt: string;
};

function toStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date();
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("hu-HU");
}

async function fetchSummary(from: string, to: string): Promise<Summary> {
  const res = await fetch(`/api/summary?from=${from}&to=${to}`);
  return res.json();
}

function SummaryTable({ summary }: { summary: Summary | null }) {
  if (!summary) return <p className="text-neutral-500">Betöltés...</p>;
  if (summary.rows.length === 0) {
    return <p className="text-neutral-500">Nincs rögzített adat ebben az időszakban.</p>;
  }
  return (
    <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100 text-neutral-600">
          <tr>
            <th className="text-left px-3 py-3">Alapanyag</th>
            <th className="text-right px-3 py-3">Mennyiség</th>
            <th className="text-right px-3 py-3">Érték (Ft)</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((r) => (
            <tr key={r.ingredientId} className="border-t border-neutral-100">
              <td className="px-3 py-3">{r.name}</td>
              <td className="px-3 py-3 text-right">
                {r.totalQuantity.toLocaleString("hu-HU")} {r.unit}
              </td>
              <td className="px-3 py-3 text-right">
                {r.totalValue.toLocaleString("hu-HU")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-300 font-semibold">
            <td className="px-3 py-3" colSpan={2}>
              Összesen
            </td>
            <td className="px-3 py-3 text-right">
              {summary.grandTotal.toLocaleString("hu-HU")} Ft
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OpenPeriodSection() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setSummary(null);
    const res = await fetch("/api/billing-periods/open");
    const openRange = await res.json();
    setRange(openRange);
    setSummary(await fetchSummary(openRange.from, openRange.to));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function closePeriod() {
    if (!range) return;
    const ok = window.confirm(
      `Biztosan leszámlázod a(z) ${formatDate(range.from)} – ${formatDate(
        range.to
      )} időszakot? Ezután a mostani tételek eltűnnek a nyitott összesítőből, de a Korábbi számlázások alatt bármikor visszanézhetők.`
    );
    if (!ok) return;

    setClosing(true);
    try {
      await fetch("/api/billing-periods", { method: "POST" });
      await load();
      window.dispatchEvent(new Event("billing-period-created"));
    } finally {
      setClosing(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">
          Nyitott időszak (nem számlázott)
          {range && (
            <span className="text-sm font-normal text-neutral-500 ml-2">
              {formatDate(range.from)} – {formatDate(range.to)}
            </span>
          )}
        </h2>
        <button
          onClick={closePeriod}
          disabled={closing || !summary || summary.rows.length === 0}
          className="w-full sm:w-auto bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500 disabled:opacity-50"
        >
          Tételek leszámlázva
        </button>
      </div>
      <SummaryTable summary={summary} />
    </section>
  );
}

function HistorySection() {
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadPeriods = useCallback(async () => {
    const res = await fetch("/api/billing-periods");
    setPeriods(await res.json());
  }, []);

  useEffect(() => {
    loadPeriods();
    window.addEventListener("billing-period-created", loadPeriods);
    return () => window.removeEventListener("billing-period-created", loadPeriods);
  }, [loadPeriods]);

  async function select(period: BillingPeriod) {
    if (selectedId === period.id) {
      setSelectedId(null);
      setSummary(null);
      return;
    }
    setSelectedId(period.id);
    setSummary(null);
    setSummary(await fetchSummary(period.from.slice(0, 10), period.to.slice(0, 10)));
  }

  if (periods.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Korábbi számlázások</h2>
      <ul className="space-y-2">
        {periods.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => select(p)}
              className="w-full text-left border border-neutral-200 bg-white rounded-2xl p-4 text-sm active:bg-neutral-100"
            >
              {formatDate(p.from)} – {formatDate(p.to)}
              <span className="text-neutral-400 ml-2">
                (lezárva: {formatDate(p.closedAt)})
              </span>
            </button>
            {selectedId === p.id && (
              <div className="mt-2">
                <SummaryTable summary={summary} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdHocSection() {
  const [from, setFrom] = useState(toStr(today()));
  const [to, setTo] = useState(toStr(today()));
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setSummary(null);
    fetchSummary(from, to).then(setSummary);
  }, [from, to]);

  function setPreset(preset: "day" | "week" | "month") {
    const t = today();
    if (preset === "day") {
      setFrom(toStr(t));
      setTo(toStr(t));
    } else if (preset === "week") {
      setFrom(toStr(startOfWeek(t)));
      setTo(toStr(t));
    } else {
      setFrom(toStr(startOfMonth(t)));
      setTo(toStr(t));
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Egyéni lekérdezés</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setPreset("day")}
            className="text-sm px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100"
          >
            Ma
          </button>
          <button
            onClick={() => setPreset("week")}
            className="text-sm px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100"
          >
            Ez a hét
          </button>
          <button
            onClick={() => setPreset("month")}
            className="text-sm px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100"
          >
            Ez a hónap
          </button>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Ettől</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Eddig</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
            />
          </div>
        </div>
      </div>
      <SummaryTable summary={summary} />
    </section>
  );
}

export default function SummaryPage() {
  return (
    <div className="space-y-10">
      <OpenPeriodSection />
      <HistorySection />
      <AdHocSection />
    </div>
  );
}
