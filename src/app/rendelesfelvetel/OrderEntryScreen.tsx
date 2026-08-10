"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoreGroup } from "@/generated/prisma/client";
import Loading from "@/components/Loading";
import { addDaysStr, budapestTodayStr, mondayOf } from "@/lib/dates";
import { getSandwichExportDay } from "@/lib/sandwichDates";
import { computeBakeryNeeds, type BakeryOrderRow } from "@/lib/sandwichBakeryOrder";
import {
  applyTemplate,
  applyTemplates,
  clearColumn,
  diffDirtyStores,
  gridTotals,
  setQuantity,
  toSavePayload,
  type GridQuantities,
} from "@/lib/sandwichGridState";
import {
  dateForWeekday,
  defaultEntryDate,
  FULL_DAY_NAMES,
  SHORT_DAY_NAMES,
  weekdayIndexOf,
} from "@/lib/weekdays";
import AddStoreDialog from "./AddStoreDialog";
import OrderGrid from "./OrderGrid";
import StoreColumnEditor from "./StoreColumnEditor";
import StoreList from "./StoreList";
import type { DayGrid, DaySaveResult, HistoryEntry } from "./types";
import { formatFt, formatShortDate } from "./types";

const DRAFT_STORAGE_KEY = "partiko_rendelesfelvetel_draft_v1";
const MAX_STORED_DRAFT_DATES = 5;
const DRAFT_DEBOUNCE_MS = 500;

type StoredDrafts = {
  version: 1;
  savedAtByDate: Record<string, string | null>;
  draftsByDate: Record<string, GridQuantities>;
};

type ViewMode = "grid" | "list";

function readStoredDrafts(): StoredDrafts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDrafts;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/** Drops a removed store from the persisted drafts, synchronously.
 *
 *  Has to happen before the day is reloaded: loadDay() restores the stored
 *  draft whenever the server's savedAt is unchanged, and removing a store that
 *  had no order for this date leaves savedAt exactly where it was - so a stale
 *  quantity would come straight back for a column nothing renders any more. */
function purgeCustomerFromStoredDrafts(customerId: string): void {
  const stored = readStoredDrafts();
  if (!stored) return;
  for (const quantities of Object.values(stored.draftsByDate)) {
    delete quantities[customerId];
  }
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Same as the write path: an unavailable localStorage is not fatal here.
  }
}

export default function OrderEntryScreen() {
  const today = budapestTodayStr();
  const [date, setDate] = useState(() => defaultEntryDate(today));
  const [weekStart, setWeekStart] = useState(() => mondayOf(defaultEntryDate(today)));

  const [grid, setGrid] = useState<DayGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savedByDate, setSavedByDate] = useState<Record<string, GridQuantities>>({});
  const [draftsByDate, setDraftsByDate] = useState<Record<string, GridQuantities>>({});
  const [serverSavedAtByDate, setServerSavedAtByDate] = useState<Record<string, string | null>>({});
  const [staleDraftDate, setStaleDraftDate] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [openStoreId, setOpenStoreId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<DaySaveResult | null>(null);

  // What was actually sent to the bakery for this date (null = nothing sent
  // yet), fetched separately from the grid so switching days doesn't need to
  // wait on it - see the pékáru summary block below the table.
  const [bakeryOrdered, setBakeryOrdered] = useState<BakeryOrderRow[] | null>(null);

  const draft = useMemo(() => draftsByDate[date] ?? {}, [draftsByDate, date]);
  const saved = useMemo(() => savedByDate[date] ?? {}, [savedByDate, date]);
  const dirty = useMemo(() => diffDirtyStores(saved, draft), [saved, draft]);
  const dirtySet = useMemo(() => new Set(dirty), [dirty]);
  const totals = useMemo(
    () => gridTotals(grid?.items ?? [], draft),
    [grid?.items, draft]
  );
  const bakeryNeeds = useMemo(
    () =>
      computeBakeryNeeds(
        (grid?.items ?? []).map((item) => ({
          itemName: item.name,
          quantity: totals.byItem[item.itemId] ?? 0,
        }))
      ),
    [grid?.items, totals.byItem]
  );
  // Compares what will actually be on hand for this date (freshly ordered +
  // whatever leftover was already in stock when that order was placed)
  // against the exact need computed live from today's grid - toOrder alone
  // would understate supply and flag a false shortage whenever there was
  // leftover stock. null = nothing was ever sent for this date. Deliberately
  // same-day on both sides (not the demand-day shift used by the actual
  // bakery order estimate in sandwichBakeryOrder.ts) - this table's job is a
  // same-day sanity check: did we order enough bread to cover what got
  // entered into today's grid (confirmed with the owner, 2026-08-10).
  const bakeryComparisonRows = useMemo(() => {
    const orderedByKey = new Map((bakeryOrdered ?? []).map((row) => [row.key, row]));
    return bakeryNeeds
      .map((row) => {
        const ordered = orderedByKey.get(row.key);
        return {
          key: row.key,
          label: row.label,
          exact: row.needed,
          available: bakeryOrdered ? (ordered?.toOrder ?? 0) + (ordered?.leftover ?? 0) : null,
          toOrder: ordered?.toOrder ?? 0,
          leftover: ordered?.leftover ?? 0,
        };
      })
      .filter((row) => row.exact > 0 || (row.available ?? 0) > 0);
  }, [bakeryNeeds, bakeryOrdered]);

  // --- view mode: matrix on a real screen, list on a phone --------------------
  useEffect(() => {
    const stored = window.localStorage.getItem(`${DRAFT_STORAGE_KEY}_view`);
    if (stored === "grid" || stored === "list") {
      setViewMode(stored);
      return;
    }
    // Read once in an effect rather than during render, so there is no
    // hydration mismatch between server and client markup.
    setViewMode(window.matchMedia("(min-width: 640px)").matches ? "grid" : "list");
  }, []);

  const chooseViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(`${DRAFT_STORAGE_KEY}_view`, mode);
  }, []);

  // --- load a day -------------------------------------------------------------
  const loadDay = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rendelesfelvetel/day?date=${targetDate}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Hiba történt (${res.status})`);
      }
      const data = (await res.json()) as DayGrid;
      setGrid(data);

      const serverSaved: GridQuantities = {};
      for (const store of data.stores) serverSaved[store.customerId] = { ...store.saved };
      setSavedByDate((prev) => ({ ...prev, [targetDate]: serverSaved }));
      setServerSavedAtByDate((prev) => ({ ...prev, [targetDate]: data.savedAt }));

      // Restore an unsent draft, but only silently when the server has not
      // moved on since it was written. If it has, keep the server data as the
      // baseline and let the owner decide - see the amber banner below.
      const stored = readStoredDrafts();
      const storedDraft = stored?.draftsByDate[targetDate];
      if (storedDraft) {
        const sameServerState = stored?.savedAtByDate[targetDate] === data.savedAt;
        setDraftsByDate((prev) => ({
          ...prev,
          [targetDate]: sameServerState ? storedDraft : serverSaved,
        }));
        setStaleDraftDate(sameServerState ? null : targetDate);
      } else {
        setDraftsByDate((prev) => ({ ...prev, [targetDate]: serverSaved }));
        setStaleDraftDate(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(date);
  }, [date, loadDay]);

  useEffect(() => {
    setBakeryOrdered(null);
    fetch(`/api/rendelesfelvetel/bakery-order?date=${date}`)
      .then((res) => res.json())
      .then((body: { rows: BakeryOrderRow[] | null }) => setBakeryOrdered(body.rows))
      .catch(() => setBakeryOrdered(null));
  }, [date]);

  // --- persist drafts ---------------------------------------------------------
  const draftsRef = useRef(draftsByDate);
  draftsRef.current = draftsByDate;
  const savedAtRef = useRef(serverSavedAtByDate);
  savedAtRef.current = serverSavedAtByDate;

  useEffect(() => {
    // Debounced: this fires on every keystroke otherwise. The stake is high -
    // losing twenty minutes of dictated orders because the phone evicted the
    // tab mid-call is the one failure this screen must not have.
    const timer = setTimeout(() => {
      const dates = Object.keys(draftsRef.current).slice(-MAX_STORED_DRAFT_DATES);
      const payload: StoredDrafts = { version: 1, savedAtByDate: {}, draftsByDate: {} };
      for (const key of dates) {
        payload.draftsByDate[key] = draftsRef.current[key];
        payload.savedAtByDate[key] = savedAtRef.current[key] ?? null;
      }
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Quota or private-mode failure: the in-memory draft still works.
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftsByDate, serverSavedAtByDate]);

  useEffect(() => {
    if (dirty.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty.length]);

  // --- mutations --------------------------------------------------------------
  const updateDraft = useCallback(
    (fn: (current: GridQuantities) => GridQuantities) => {
      setSendResult(null);
      setDraftsByDate((prev) => ({ ...prev, [date]: fn(prev[date] ?? {}) }));
    },
    [date]
  );

  const handleSetQuantity = useCallback(
    (customerId: string, itemId: string, quantity: number) =>
      updateDraft((current) => setQuantity(current, customerId, itemId, quantity)),
    [updateDraft]
  );

  const loadAllFixOrders = useCallback(
    (mode: "replace" | "onlyEmpty") => {
      if (!grid) return;
      const templates: Record<string, Record<string, number>> = {};
      for (const store of grid.stores) {
        if (store.onFixList) templates[store.customerId] = store.fix;
      }
      updateDraft((current) => applyTemplates(current, templates, mode));
    },
    [grid, updateDraft]
  );

  const handleSend = useCallback(async () => {
    if (!grid || dirty.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/rendelesfelvetel/day", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, stores: toSavePayload(draft, dirty) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Hiba történt (${res.status})`);
      }
      const result = (await res.json()) as DaySaveResult;

      // Only now does the draft become the baseline. On failure everything -
      // including localStorage - is left exactly as it was.
      setSavedByDate((prev) => ({ ...prev, [date]: draft }));
      setServerSavedAtByDate((prev) => ({ ...prev, [date]: result.savedAt }));
      setSendResult(result);
      setStaleDraftDate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
    } finally {
      setSending(false);
    }
  }, [grid, dirty, date, draft]);

  const saveStoreAsFix = useCallback(
    async (customerId: string) => {
      const res = await fetch("/api/rendelesfelvetel/fix-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday: weekdayIndexOf(date),
          stores: [
            {
              customerId,
              items: Object.entries(draft[customerId] ?? {}).map(([itemId, quantity]) => ({
                itemId,
                quantity,
              })),
              active: true,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Nem sikerült menteni a fix rendelést");
      // Keep the in-memory grid in step so the editor's "load fix order" button
      // immediately reflects what was just stored.
      setGrid((prev) =>
        prev === null
          ? prev
          : {
              ...prev,
              stores: prev.stores.map((store) =>
                store.customerId === customerId
                  ? { ...store, onFixList: true, fix: { ...(draft[customerId] ?? {}) } }
                  : store
              ),
            }
      );
    },
    [date, draft]
  );

  // --- roster edits (add / remove / regroup a store) ---------------------------
  const handleStoreAdded = useCallback(async () => {
    setAddOpen(false);
    // Nothing about an order changed, so savedAt is unchanged and loadDay
    // restores the unsent draft as usual - adding a column never costs work.
    await loadDay(date);
  }, [date, loadDay]);

  const handleStoreRemoved = useCallback(
    async (customerId: string) => {
      // A removed store must not survive anywhere in client state: a leftover
      // quantity would count as an unsaved change for a column nothing renders,
      // making the send bar claim work that cannot be reviewed, and PUT /day
      // would write the order straight back.
      purgeCustomerFromStoredDrafts(customerId);
      const strip = (byDate: Record<string, GridQuantities>) =>
        Object.fromEntries(
          Object.entries(byDate).map(([key, quantities]) => {
            const next = { ...quantities };
            delete next[customerId];
            return [key, next];
          })
        );
      setDraftsByDate(strip);
      setSavedByDate(strip);
      setOpenStoreId(null);
      setSendResult(null);
      await loadDay(date);
    },
    [date, loadDay]
  );

  const handleGroupChanged = useCallback((customerId: string, storeGroup: StoreGroup) => {
    // Patched in place rather than reloading: the column just moves to another
    // block, and a reload would risk the stale-draft banner for no reason.
    setGrid((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            stores: prev.stores.map((store) =>
              store.customerId === customerId ? { ...store, storeGroup } : store
            ),
          }
    );
  }, []);

  // --- derived UI bits --------------------------------------------------------
  const weekday = weekdayIndexOf(date) ?? 0;
  const dayLabel = `${FULL_DAY_NAMES[weekday]} (${formatShortDate(date)})`;
  const openStore = grid?.stores.find((s) => s.customerId === openStoreId) ?? null;
  const alreadyExported = date <= getSandwichExportDay().date;

  const dirtyDates = useMemo(() => {
    const result = new Set<string>();
    for (const [key, value] of Object.entries(draftsByDate)) {
      if (diffDirtyStores(savedByDate[key] ?? {}, value).length > 0) result.add(key);
    }
    return result;
  }, [draftsByDate, savedByDate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Rendelésfelvétel</h1>
        <Link
          href="/rendelesek"
          className="shrink-0 text-sm font-bold text-ink bg-gold rounded-full px-4 py-2 active:bg-gold-dark"
        >
          Összesítések
        </Link>
      </div>

      {/* --- week + day navigation --- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              const next = addDaysStr(weekStart, -7);
              setWeekStart(next);
              setDate(dateForWeekday(next, weekday));
            }}
            className="px-3 py-1.5 rounded-lg border bg-umber/8 border-umber/40 active:bg-umber/15"
          >
            ◀ Előző hét
          </button>
          <span className="text-muted">
            {formatShortDate(weekStart)} – {formatShortDate(addDaysStr(weekStart, 4))}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = addDaysStr(weekStart, 7);
              setWeekStart(next);
              setDate(dateForWeekday(next, weekday));
            }}
            className="px-3 py-1.5 rounded-lg border bg-umber/8 border-umber/40 active:bg-umber/15"
          >
            Következő hét ▶
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {SHORT_DAY_NAMES.map((name, i) => {
            const tabDate = dateForWeekday(weekStart, i);
            const isActive = tabDate === date;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setDate(tabDate)}
                className={`py-2 rounded-lg text-sm font-medium border ${
                  isActive
                    ? "bg-gold text-ink border-gold"
                    : "bg-umber/8 border-umber/40 active:bg-umber/15"
                }`}
              >
                {name}
                {dirtyDates.has(tabDate) && <span className="ml-1 text-umber-dark">●</span>}
              </button>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted">{dayLabel}</p>
      </div>

      {alreadyExported && (
        <p className="text-sm text-umber-dark bg-gold/10 border border-gold/50 rounded-xl px-3 py-2">
          Ezt a napot a konyha már letöltötte — a módosítás nem biztos, hogy eljut hozzájuk.
        </p>
      )}

      {staleDraftDate === date && (
        <div className="text-sm bg-gold/10 border border-gold/50 rounded-xl px-3 py-2 space-y-2">
          <p className="text-umber-dark">
            Volt mentetlen módosításod ezen a napon, de közben változtak az adatok a szerveren. A
            szerver adatait töltöttük be.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const stored = readStoredDrafts()?.draftsByDate[date];
                if (stored) setDraftsByDate((prev) => ({ ...prev, [date]: stored }));
                setStaleDraftDate(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-gold-dark bg-surface active:bg-gold/15"
            >
              Módosításaim visszaállítása
            </button>
            <button
              type="button"
              onClick={() => setStaleDraftDate(null)}
              className="px-3 py-1.5 rounded-lg border border-umber/40 bg-umber/8 active:bg-umber/15"
            >
              Eldobás
            </button>
          </div>
        </div>
      )}

      {/* --- bulk actions + view toggle --- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => loadAllFixOrders("replace")}
          disabled={!grid}
          className="border border-gold bg-gold/10 text-sm rounded-xl px-3 py-2 font-medium active:bg-gold/15 disabled:opacity-40"
        >
          Fix rendelések betöltése
        </button>
        <button
          type="button"
          onClick={() => loadAllFixOrders("onlyEmpty")}
          disabled={!grid}
          className="border bg-umber/8 border-umber/40 text-sm rounded-xl px-3 py-2 active:bg-umber/15 disabled:opacity-40"
        >
          Csak az üresekbe
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!grid}
          className="border bg-umber/8 border-umber/40 text-sm rounded-xl px-3 py-2 active:bg-umber/15 disabled:opacity-40"
        >
          + Bolt hozzáadása
        </button>
        <div className="ml-auto flex rounded-xl border border-strong overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => chooseViewMode("grid")}
            className={`px-3 py-2 ${viewMode === "grid" ? "bg-gold text-ink" : "active:bg-surface-alt"}`}
          >
            Táblázat
          </button>
          <button
            type="button"
            onClick={() => chooseViewMode("list")}
            className={`px-3 py-2 border-l border-strong ${
              viewMode === "list" ? "bg-gold text-ink" : "active:bg-surface-alt"
            }`}
          >
            Lista
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {sendResult && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800/60 rounded-xl px-3 py-2">
          Mentve: {sendResult.createdCount + sendResult.updatedCount} bolt módosítva
          {sendResult.deletedCount > 0 && `, ${sendResult.deletedCount} törölve`} · a nap összesen{" "}
          {sendResult.totalQuantity} db · {formatFt(sendResult.totalValueFt)}
        </p>
      )}

      {!loading && grid && (
        <div className="text-center bg-gold/10 border border-gold/40 rounded-2xl px-4 py-3">
          <span className="text-sm font-medium">
            Ezen a napon <span className="font-bold">{totals.totalQuantity}</span> szendvics volt
            összesen
          </span>
        </div>
      )}

      {/* --- the grid itself --- */}
      {loading && <Loading />}

      {!loading && grid && grid.stores.length === 0 && (
        <p className="text-center text-muted py-10">
          Erre a napra nincs bolt a listán, és rendelés sincs. A „Bolt hozzáadása” gombbal vehetsz
          fel egyet.
        </p>
      )}

      {!loading && grid && grid.stores.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <OrderGrid
              items={grid.items}
              stores={grid.stores}
              quantities={draft}
              totals={totals}
              dirty={dirtySet}
              onSetQuantity={handleSetQuantity}
              onOpenStore={setOpenStoreId}
            />
          ) : (
            <StoreList
              stores={grid.stores}
              totals={totals}
              dirty={dirtySet}
              onOpenStore={setOpenStoreId}
            />
          )}
        </>
      )}

      {!loading && grid && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Pékáru – rendelkezésre áll vs. pontos igény
          </h2>
          {bakeryComparisonRows.length === 0 ? (
            <p className="text-sm text-muted">Erre a napra nincs pékáru-igényt jelentő szendvics.</p>
          ) : (
            <div className="border border-surface-border bg-surface rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-surface-alt text-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Pékáru</th>
                    <th className="text-right px-3 py-2">Rendelkezésre áll</th>
                    <th className="text-right px-3 py-2">Pontos igény</th>
                  </tr>
                </thead>
                <tbody>
                  {bakeryComparisonRows.map((row) => {
                    const short = row.available !== null && row.available < row.exact;
                    return (
                      <tr key={row.key} className="border-t border-surface-border">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-right">
                          {row.available === null ? (
                            <span className="text-faint">nincs rendelve</span>
                          ) : (
                            <>
                              {row.available} db
                              {row.leftover > 0 && (
                                <div className="text-xs text-faint">
                                  {row.toOrder} rendelve + {row.leftover} maradék
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            short ? "text-red-600 dark:text-red-400" : ""
                          }`}
                        >
                          {row.exact} db
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-faint">
            A "Rendelkezésre áll" a pékáru rendelés gombbal ténylegesen elküldött mennyiség PLUSZ az
            akkor megadott maradék erre a napra, a "Pontos igény" pedig az ezen a napon most rögzített
            rendelésekből számolt friss szükséglet.
          </p>
        </section>
      )}

      {openStore && grid && (
        <StoreColumnEditor
          store={openStore}
          items={grid.items}
          column={draft[openStore.customerId] ?? {}}
          dayLabel={dayLabel}
          date={date}
          weekday={weekday}
          onSetQuantity={(itemId, quantity) =>
            handleSetQuantity(openStore.customerId, itemId, quantity)
          }
          onApplyFix={() =>
            updateDraft((current) =>
              applyTemplate(current, openStore.customerId, openStore.fix, "replace")
            )
          }
          onApplyHistory={(entry: HistoryEntry) =>
            updateDraft((current) =>
              applyTemplate(
                current,
                openStore.customerId,
                Object.fromEntries(entry.lines.map((line) => [line.itemId, line.quantity])),
                "replace"
              )
            )
          }
          onClear={() => updateDraft((current) => clearColumn(current, openStore.customerId))}
          onSaveAsFix={() => saveStoreAsFix(openStore.customerId)}
          onGroupChanged={handleGroupChanged}
          onRemoved={handleStoreRemoved}
          onClose={() => setOpenStoreId(null)}
        />
      )}

      {addOpen && grid && (
        <AddStoreDialog
          weekday={weekday}
          onDayStoreIds={new Set(grid.stores.map((store) => store.customerId))}
          onAdded={handleStoreAdded}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* --- send bar --- */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || dirty.length === 0}
            className="w-full bg-gold text-ink font-semibold text-base px-5 py-3.5 rounded-xl shadow-lg active:bg-gold-dark disabled:bg-surface-alt disabled:text-muted disabled:shadow-none"
          >
            {sending
              ? "Küldés…"
              : dirty.length === 0
                ? "Nincs mentetlen módosítás"
                : `Rendelések elküldése (${dirty.length} bolt)`}
          </button>
        </div>
      </div>
    </div>
  );
}
