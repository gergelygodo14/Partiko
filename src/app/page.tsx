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
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastClosedAt, setLastClosedAt] = useState<string | null>(null);

  const loadEntries = useCallback(async (forDate: string) => {
    const res = await fetch(`/api/entries?date=${forDate}`);
    const data = await res.json();
    setEntries(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/ingredients");
      setIngredients(await res.json());
      const openRes = await fetch("/api/billing-periods/open");
      const open = await openRes.json();
      setLastClosedAt(open.lastClosedAt);
      await loadEntries(date);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEntries(date);
  }, [date, loadEntries]);

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
      await loadEntries(date);
    } finally {
      setSavingId(null);
    }
  }

  async function removeEntry(id: string) {
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    await loadEntries(date);
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
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
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
            const todays = entriesByIngredient.get(ing.id) ?? [];
            const sum = todays.reduce((s, e) => s + e.quantity, 0);
            return (
              <li
                key={ing.id}
                className="border border-neutral-200 bg-white rounded-lg p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{ing.name}</div>
                    <div className="text-xs text-neutral-500">
                      {ing.unit} · {ing.unitPrice.toLocaleString("hu-HU")} Ft/
                      {ing.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
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
                      className="w-24 border border-neutral-300 rounded-md px-2 py-2 text-sm text-right"
                    />
                    <button
                      onClick={() => addEntry(ing.id)}
                      disabled={savingId === ing.id}
                      className="bg-neutral-900 text-white text-sm px-3 py-2 rounded-md disabled:opacity-50"
                    >
                      Hozzáadás
                    </button>
                  </div>
                </div>

                {todays.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {todays.map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center gap-1 bg-neutral-100 rounded-full px-3 py-1"
                      >
                        {e.quantity.toLocaleString("hu-HU")}
                        <button
                          onClick={() => removeEntry(e.id)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label="Törlés"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <span className="text-neutral-500">
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
