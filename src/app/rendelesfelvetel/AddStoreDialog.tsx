"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreGroup } from "@/generated/prisma/client";
import {
  STORE_GROUP_LABELS,
  STORE_GROUP_ORDER,
  suggestStoreGroup,
} from "@/lib/sandwichStoreGroups";
import { DAY_ADJECTIVES, DAY_ONTO, WEEKDAY_COUNT } from "@/lib/weekdays";

type PickerStore = {
  customerId: string;
  storeName: string;
  storeGroup: StoreGroup;
  storeOrder: number;
};

/** Accent- and case-insensitive, because the owner types "fav ag" for "Fav Ág u"
 *  and a diacritic-exact search would come back empty. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function AddStoreDialog({
  weekday,
  onDayStoreIds,
  onAdded,
  onClose,
}: {
  weekday: number;
  /** Stores already on this day's table - shown, but not addable again. */
  onDayStoreIds: Set<string>;
  onAdded: (storeName: string) => void;
  onClose: () => void;
}) {
  const [allStores, setAllStores] = useState<PickerStore[]>([]);
  const [query, setQuery] = useState("");
  const [everyDay, setEveryDay] = useState(false);
  const [newGroup, setNewGroup] = useState<StoreGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rendelesfelvetel/stores")
      .then((res) => (res.ok ? res.json() : { stores: [] }))
      .then((data) => setAllStores(data.stores ?? []))
      .catch(() => setError("Nem sikerült betölteni a boltok listáját."));
  }, []);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    const needle = normalize(trimmed);
    if (needle.length === 0) return allStores.filter((store) => !onDayStoreIds.has(store.customerId));
    return allStores.filter((store) => normalize(store.storeName).includes(needle));
  }, [allStores, trimmed, onDayStoreIds]);

  // Only offer to create when nothing in the list is that exact name - otherwise
  // the find-or-create would just hand back the existing one anyway, and the
  // extra button would only invite a duplicate-looking click.
  const exactExists = allStores.some((store) => normalize(store.storeName) === normalize(trimmed));
  const canCreate = trimmed.length > 0 && !exactExists;
  const weekdays = everyDay ? Array.from({ length: WEEKDAY_COUNT }, (_, i) => i) : [weekday];

  async function add(payload: Record<string, unknown>, storeName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rendelesfelvetel/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, weekdays }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Hiba történt (${res.status})`);
      onAdded(body.storeName ?? storeName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-bold text-umber-dark bg-umber/10 border border-umber/50 rounded-full px-3.5 py-1.5 active:bg-umber/20"
        >
          ‹ Vissza
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Bolt hozzáadása</div>
          <div className="text-xs text-neutral-500">{DAY_ADJECTIVES[weekday]} lista</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Bolt neve…"
          autoFocus
          className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-base"
        />

        <div className="flex rounded-xl border border-neutral-300 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setEveryDay(false)}
            className={`flex-1 px-3 py-2.5 ${!everyDay ? "bg-gold text-ink font-medium" : "active:bg-neutral-100"}`}
          >
            Csak {DAY_ONTO[weekday]}
          </button>
          <button
            type="button"
            onClick={() => setEveryDay(true)}
            className={`flex-1 px-3 py-2.5 border-l border-neutral-300 ${
              everyDay ? "bg-gold text-ink font-medium" : "active:bg-neutral-100"
            }`}
          >
            Minden napra (H–P)
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {canCreate && (
          <div className="border border-gold bg-gold/10 rounded-2xl p-3 space-y-3">
            <div className="text-sm font-medium">Új bolt létrehozása: „{trimmed}”</div>
            <div>
              <div className="text-xs text-neutral-500 mb-1.5">Hova tartozik?</div>
              <div className="flex flex-wrap gap-1.5">
                {STORE_GROUP_ORDER.map((group) => {
                  const selected = (newGroup ?? suggestStoreGroup(trimmed)) === group;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setNewGroup(group)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        selected
                          ? "bg-ink text-white border-ink"
                          : "bg-white border-neutral-300 active:bg-neutral-100"
                      }`}
                    >
                      {STORE_GROUP_LABELS[group]}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                add(
                  { storeName: trimmed, storeGroup: newGroup ?? suggestStoreGroup(trimmed) },
                  trimmed
                )
              }
              className="w-full bg-gold text-ink font-semibold px-4 py-2.5 rounded-xl active:bg-gold-dark disabled:opacity-40"
            >
              {busy ? "Hozzáadás…" : "Létrehozás és hozzáadás"}
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-sm font-medium text-neutral-600">
            {trimmed.length > 0 ? "Találatok" : "Boltok, amik nincsenek ezen a napon"}
          </div>
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-neutral-100">
            {matches.length === 0 && (
              <p className="px-3 py-4 text-sm text-neutral-400">
                {trimmed.length > 0
                  ? "Nincs ilyen nevű bolt — fentebb létrehozhatod újként."
                  : "Minden bolt rajta van ezen a napon."}
              </p>
            )}
            {matches.map((store) => {
              const already = onDayStoreIds.has(store.customerId);
              return (
                <button
                  key={store.customerId}
                  type="button"
                  disabled={already || busy}
                  onClick={() => add({ customerId: store.customerId }, store.storeName)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-neutral-50 disabled:opacity-40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{store.storeName}</div>
                    <div className="text-xs text-neutral-400">
                      {STORE_GROUP_LABELS[store.storeGroup]}
                    </div>
                  </div>
                  <span className="text-sm text-neutral-400 shrink-0">
                    {already ? "már a listán" : "+ hozzáad"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-neutral-400 pb-8">
          A hozzáadott bolt csak ezen a képernyőn jelenik meg — a konyhai nyomtatványra és az
          összesítésekbe csak akkor kerül rá, ha ténylegesen rendel is.
        </p>
      </div>
    </div>
  );
}
