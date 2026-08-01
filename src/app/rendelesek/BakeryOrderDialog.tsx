"use client";

import { useEffect, useMemo, useState } from "react";
import type { BakeryProductKey } from "@/lib/sandwichBakeryOrder";

type NeedRow = { key: BakeryProductKey; label: string; needed: number };
type NeedsResponse = { date: string; dayName: string; isEstimate: boolean; needs: NeedRow[] };

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

export default function BakeryOrderDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<NeedsResponse | null>(null);
  const [leftovers, setLeftovers] = useState<Partial<Record<BakeryProductKey, string>>>({});
  const [sending, setSending] = useState(false);
  const [sentText, setSentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sandwich-orders/bakery-order")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setError("Nem sikerült betölteni a szendvics összesítést."));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.needs.map((row) => {
      const leftover = Number(leftovers[row.key] ?? 0) || 0;
      return { ...row, leftover, toOrder: Math.max(row.needed - leftover, 0) };
    });
  }, [data, leftovers]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const numericLeftovers: Partial<Record<BakeryProductKey, number>> = {};
      for (const [key, value] of Object.entries(leftovers)) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) numericLeftovers[key as BakeryProductKey] = n;
      }
      const res = await fetch("/api/sandwich-orders/bakery-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftovers: numericLeftovers }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Hiba történt (${res.status})`);
      if (!body.sent) throw new Error(body.error ?? "A Telegram üzenet küldése nem sikerült.");
      setSentText(body.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-neutral-600 active:opacity-60"
        >
          ‹ Vissza
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Pékáru rendelés</div>
          {data && (
            <div className="text-xs text-neutral-500">
              {data.dayName} ({formatDate(data.date)})
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {!data ? (
          <p className="text-neutral-500">Betöltés...</p>
        ) : sentText ? (
          <div className="space-y-3">
            <div className="border border-green-300 bg-green-50 rounded-2xl p-4 space-y-2">
              <div className="font-semibold text-green-800">Elküldve Telegramra ✓</div>
              <pre className="whitespace-pre-wrap text-sm text-neutral-700 font-sans">{sentText}</pre>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-yellow-400 text-black font-semibold px-4 py-3 rounded-xl active:bg-yellow-500"
            >
              Bezárás
            </button>
          </div>
        ) : (
          <>
            {data.isEstimate ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                Ma nem szombat van, ezért a szükséges mennyiség csak becslés — az előző hét ugyanerre
                a napra ({data.dayName}) leadott rendelések alapján.
              </p>
            ) : (
              <p className="text-xs text-neutral-500 bg-neutral-100 rounded-xl px-3 py-2.5">
                Szombat van, ezért a mennyiség pontos — a holnapi (hétfői) rendelések alapján.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-sm text-neutral-500">Írd be, miből mennyi maradt a raktárban:</p>

            <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-neutral-100">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-3 px-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-neutral-400">szükséges: {row.needed} db</div>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="maradék"
                    value={leftovers[row.key] ?? ""}
                    onChange={(e) =>
                      setLeftovers((prev) => ({ ...prev, [row.key]: e.target.value }))
                    }
                    className="w-20 border border-neutral-300 rounded-lg px-2 py-1.5 text-right text-sm"
                  />
                  <div className="w-20 text-right">
                    <div className="font-semibold">{row.toOrder}</div>
                    <div className="text-[10px] text-neutral-400">rendelendő</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={send}
              className="w-full bg-yellow-400 text-black font-semibold px-4 py-3 rounded-xl active:bg-yellow-500 disabled:opacity-50"
            >
              {sending ? "Küldés…" : "Küldés Telegramra"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
