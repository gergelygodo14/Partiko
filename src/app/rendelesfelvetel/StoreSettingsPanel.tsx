"use client";

import { useEffect, useState } from "react";
import type { StoreGroup } from "@/generated/prisma/client";
import { STORE_GROUP_LABELS, STORE_GROUP_ORDER } from "@/lib/sandwichStoreGroups";
import { DAY_ADJECTIVES, SHORT_DAY_NAMES } from "@/lib/weekdays";
import type { GridStore } from "./types";

type RemovalInfo = {
  storeName: string;
  roundWeekdays: number[];
  quantityOnDate: number;
  hasOrderOnDate: boolean;
  sandwichOrderCount: number;
  readyMealOrderCount: number;
  deletable: boolean;
};

/** Everything about the store itself, as opposed to today's quantities: which
 *  group its column sits in, and the three ways to take it off the table.
 *
 *  Lives at the bottom of the single-store editor rather than behind an
 *  "edit mode" on the grid - there is exactly one place that already means
 *  "this one store", and 30 little ✕ buttons over the column headers would be a
 *  mis-tap waiting to happen on a phone. */
export default function StoreSettingsPanel({
  store,
  date,
  weekday,
  onGroupChanged,
  onRemoved,
}: {
  store: GridStore;
  date: string;
  weekday: number;
  onGroupChanged: (storeGroup: StoreGroup) => void;
  onRemoved: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<RemovalInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched only when the confirm block is opened: the counts cost two queries
  // and nobody needs them while simply typing quantities.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setInfo(null);
    fetch(
      `/api/rendelesfelvetel/stores/${encodeURIComponent(store.customerId)}?date=${encodeURIComponent(date)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, store.customerId, date]);

  async function changeGroup(storeGroup: StoreGroup) {
    setError(null);
    try {
      const res = await fetch(`/api/rendelesfelvetel/stores/${encodeURIComponent(store.customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeGroup }),
      });
      if (!res.ok) throw new Error("Nem sikerült átsorolni a boltot");
      onGroupChanged(storeGroup);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
    }
  }

  async function remove(scope: "weekday" | "allWeekdays" | "customer") {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope });
      if (scope === "weekday") params.set("weekday", String(weekday));
      if (scope !== "customer") params.set("date", date);

      const res = await fetch(
        `/api/rendelesfelvetel/stores/${encodeURIComponent(store.customerId)}?${params}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Hiba történt (${res.status})`);
      onRemoved(store.customerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
      setBusy(false);
    }
  }

  const orderCount = (info?.sandwichOrderCount ?? 0) + (info?.readyMealOrderCount ?? 0);

  return (
    <div className="border-t border-neutral-200 pt-4 space-y-3">
      <div className="text-sm font-medium text-neutral-600">Bolt beállításai</div>

      <div>
        <div className="text-xs text-neutral-500 mb-1.5">
          Csoport — ez dönti el, hol áll az oszlopa, a konyhai nyomtatványon is.
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STORE_GROUP_ORDER.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => changeGroup(group)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                store.storeGroup === group
                  ? "bg-ink text-white border-ink"
                  : "bg-white border-neutral-300 active:bg-neutral-100"
              }`}
            >
              {STORE_GROUP_LABELS[group]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-red-600 border border-red-200 rounded-xl px-3.5 py-2.5 active:bg-red-50"
        >
          Bolt eltávolítása
        </button>
      ) : (
        <div className="border border-red-200 bg-red-50 rounded-2xl p-3 space-y-3">
          <div className="text-sm font-medium">{store.storeName} eltávolítása</div>

          {info === null ? (
            <p className="text-sm text-neutral-500">Betöltés…</p>
          ) : (
            <>
              <p className="text-xs text-neutral-600">
                Jelenleg ezeken a napokon van a listán:{" "}
                <span className="font-medium">
                  {info.roundWeekdays.length > 0
                    ? info.roundWeekdays.map((day) => SHORT_DAY_NAMES[day]).join(", ")
                    : "egyiken sem"}
                </span>
                {info.hasOrderOnDate && (
                  <>
                    {" · "}
                    <span className="text-red-700 font-medium">
                      ezen a napon {info.quantityOnDate} db rendelése van, az is törlődik
                    </span>
                  </>
                )}
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={() => remove("weekday")}
                className="w-full text-left bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 active:bg-neutral-100 disabled:opacity-40"
              >
                <div className="text-sm font-medium">
                  Levétel a {DAY_ADJECTIVES[weekday]} listáról
                </div>
                <div className="text-xs text-neutral-500">A többi nap érintetlen marad.</div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => remove("allWeekdays")}
                className="w-full text-left bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 active:bg-neutral-100 disabled:opacity-40"
              >
                <div className="text-sm font-medium">Levétel minden napról (H–P)</div>
                <div className="text-xs text-neutral-500">
                  A bolt megmarad, a korábbi rendelései is — csak nem jelenik meg többé a
                  felvételnél.
                </div>
              </button>

              <button
                type="button"
                disabled={busy || !info.deletable}
                onClick={() => remove("customer")}
                className="w-full text-left bg-white border border-red-300 rounded-xl px-3.5 py-2.5 active:bg-red-100 disabled:opacity-40"
              >
                <div className="text-sm font-medium text-red-700">Bolt végleges törlése</div>
                <div className="text-xs text-neutral-500">
                  {info.deletable
                    ? "Nincs egyetlen rendelése sem, nyugodtan törölhető (pl. elgépelt név)."
                    : `${orderCount} korábbi rendelése van, ezért nem törölhető — vedd le a listákról helyette.`}
                </div>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="text-sm text-neutral-500 underline active:opacity-60 disabled:opacity-40"
          >
            Mégse
          </button>
        </div>
      )}
    </div>
  );
}
