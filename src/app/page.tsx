"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
};

type Entry = {
  id: string;
  ingredientId: string;
  quantity: number;
  date: string;
  createdAt: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

const VISIBLE_ENTRY_COUNT = 3;

function weekLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("hu-HU");
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export default function DailyEntryPage() {
  const [date, setDate] = useState(todayStr());
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [openRange, setOpenRange] = useState<{ from: string; to: string } | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastClosedAt, setLastClosedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadEntries = useCallback(async (from: string, to: string) => {
    const res = await fetch(`/api/entries?from=${from}&to=${to}`);
    setEntries(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ingredientsRes, openRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/billing-periods/open"),
      ]);
      const [ingredientsData, open] = await Promise.all([
        ingredientsRes.json(),
        openRes.json(),
      ]);
      setIngredients(ingredientsData);
      setLastClosedAt(open.lastClosedAt);
      // `open.from` can land after `open.to` when a billing period was
      // closed earlier today (intentional for the Összesítő summary, which
      // must not re-include a day that's already inside a closed period) -
      // but this page still needs to show/record entries added today after
      // that close, so widen the fetch range here to never exclude today.
      const from = open.from > open.to ? open.to : open.from;
      setOpenRange({ from, to: open.to });
      await loadEntries(from, open.to);
      setLoading(false);
    })();
  }, [loadEntries]);

  // Open (unbilled) entries stay visible under each ingredient all week -
  // regardless of which date the picker is on - so they can still be
  // edited/removed right up until billing closes the period.
  const entriesByIngredient = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const cutoff = lastClosedAt ? new Date(lastClosedAt).getTime() : null;
    for (const e of entries) {
      if (cutoff !== null && new Date(e.createdAt).getTime() <= cutoff) continue;
      const list = map.get(e.ingredientId) ?? [];
      list.push(e);
      map.set(e.ingredientId, list);
    }
    return map;
  }, [entries, lastClosedAt]);

  async function reloadOpenEntries() {
    if (openRange) await loadEntries(openRange.from, openRange.to);
  }

  async function addEntry(ingredientId: string) {
    const raw = inputs[ingredientId];
    const quantity = parseFloat((raw ?? "").replace(",", "."));
    if (!quantity || quantity <= 0) return;

    setSavingId(ingredientId);
    try {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId, date, quantity }),
      });
      setInputs((prev) => ({ ...prev, [ingredientId]: "" }));
      await reloadOpenEntries();
    } finally {
      setSavingId(null);
    }
  }

  async function removeEntry(id: string) {
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    await reloadOpenEntries();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-neutral-500">Ez a hét: {weekLabel(date)}</div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-600" htmlFor="date">
            Dátum
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-neutral-500">Betöltés...</p>
      ) : ingredients.length === 0 ? (
        <p className="text-neutral-500">
          Nincs még alapanyag felvéve. Vedd fel az{" "}
          <a href="/alapanyagok" className="underline">
            Alapanyagok
          </a>{" "}
          oldalon.
        </p>
      ) : (
        <ul className="space-y-3">
          {ingredients.map((ing) => {
            const openEntries = entriesByIngredient.get(ing.id) ?? [];
            const sum = openEntries.reduce((s, e) => s + e.quantity, 0);
            return (
              <li
                key={ing.id}
                className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-base">{ing.name}</div>
                    <div className="text-xs text-neutral-500">
                      {ing.unit} · {ing.unitPrice.toLocaleString("hu-HU")} Ft/
                      {ing.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="mennyiség"
                      value={inputs[ing.id] ?? ""}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [ing.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addEntry(ing.id);
                      }}
                      className="flex-1 sm:w-24 sm:flex-none border border-neutral-300 rounded-xl px-3 py-3 text-base text-right"
                    />
                    <button
                      onClick={() => addEntry(ing.id)}
                      disabled={savingId === ing.id}
                      className="bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500 disabled:opacity-50 whitespace-nowrap"
                    >
                      Hozzáadás
                    </button>
                  </div>
                </div>

                {openEntries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {(expanded[ing.id]
                      ? openEntries
                      : openEntries.slice(-VISIBLE_ENTRY_COUNT)
                    ).map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center gap-1.5 bg-neutral-100 rounded-full pl-3 pr-1.5 py-1.5"
                      >
                        <span className="text-neutral-400 text-xs">{formatShort(e.date)}</span>
                        {e.quantity.toLocaleString("hu-HU")}
                        <button
                          onClick={() => removeEntry(e.id)}
                          className="text-neutral-400 active:text-red-600 w-6 h-6 flex items-center justify-center rounded-full"
                          aria-label="Törlés"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {openEntries.length > VISIBLE_ENTRY_COUNT && (
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [ing.id]: !prev[ing.id] }))
                        }
                        className="inline-flex items-center gap-1 bg-neutral-100 active:bg-neutral-200 rounded-full px-3 py-1.5 text-neutral-600"
                        aria-label={expanded[ing.id] ? "Összecsukás" : "Összes tétel mutatása"}
                      >
                        {expanded[ing.id] ? (
                          "▲"
                        ) : (
                          <>+{openEntries.length - VISIBLE_ENTRY_COUNT} ▼</>
                        )}
                      </button>
                    )}
                    <span className="text-neutral-500 flex items-center">
                      = {sum.toLocaleString("hu-HU")} {ing.unit}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
