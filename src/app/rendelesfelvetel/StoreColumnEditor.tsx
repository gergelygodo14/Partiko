"use client";

import { useEffect, useState } from "react";
import EditableQty from "@/components/EditableQty";
import type { StoreGroup } from "@/generated/prisma/client";
import { MIN_ORDER_VALUE_FT } from "@/lib/sandwichOrders";
import { STORE_GROUP_LABELS } from "@/lib/sandwichStoreGroups";
import StoreSettingsPanel from "./StoreSettingsPanel";
import type { GridItem, GridStore, HistoryEntry } from "./types";
import { formatFt, formatShortDate } from "./types";

type Props = {
  store: GridStore;
  items: GridItem[];
  column: Record<string, number>;
  dayLabel: string;
  date: string;
  weekday: number;
  onSetQuantity: (itemId: string, quantity: number) => void;
  onApplyFix: () => void;
  onApplyHistory: (entry: HistoryEntry) => void;
  onClear: () => void;
  onSaveAsFix: () => Promise<void>;
  onGroupChanged: (customerId: string, storeGroup: StoreGroup) => void;
  onRemoved: (customerId: string) => void;
  onClose: () => void;
};

/** Full-screen single-store editor: the phone-friendly way in, and the escape
 *  hatch from the matrix on any device. Same shape as the customer app's order
 *  form, plus the fix-order and history prefills. */
export default function StoreColumnEditor({
  store,
  items,
  column,
  dayLabel,
  date,
  weekday,
  onSetQuantity,
  onApplyFix,
  onApplyHistory,
  onClear,
  onSaveAsFix,
  onGroupChanged,
  onRemoved,
  onClose,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savingFix, setSavingFix] = useState(false);
  const [fixSaved, setFixSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // History is a convenience, never a blocker - a failure just leaves the
    // strip empty rather than breaking the editor.
    fetch(`/api/rendelesfelvetel/history?customerId=${encodeURIComponent(store.customerId)}`)
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => {
        if (!cancelled) setHistory(data.history ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [store.customerId]);

  const totalQuantity = items.reduce((sum, item) => sum + (column[item.itemId] ?? 0), 0);
  const totalValue = items.reduce(
    (sum, item) => sum + (column[item.itemId] ?? 0) * item.price,
    0
  );
  const hasFix = Object.keys(store.fix).length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto">
      <div className="sticky top-0 bg-surface border-b border-surface-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-bold text-umber-dark bg-umber/10 border border-umber/50 rounded-full px-3.5 py-1.5 active:bg-umber/20"
        >
          ‹ Vissza
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{store.storeName}</div>
          <div className="text-xs text-muted">
            {dayLabel} · {STORE_GROUP_LABELS[store.storeGroup]}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-32">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApplyFix}
            disabled={!hasFix}
            className="border border-gold bg-gold/10 text-sm rounded-xl px-3.5 py-2.5 font-medium active:bg-gold/15 disabled:opacity-40"
          >
            Fix rendelés betöltése
          </button>
          <button
            type="button"
            onClick={onClear}
            className="border bg-umber/8 border-umber/40 text-sm rounded-xl px-3.5 py-2.5 active:bg-umber/15"
          >
            Oszlop ürítése
          </button>
          <button
            type="button"
            onClick={async () => {
              setSavingFix(true);
              try {
                await onSaveAsFix();
                setFixSaved(true);
              } finally {
                setSavingFix(false);
              }
            }}
            disabled={savingFix}
            className="border bg-umber/8 border-umber/40 text-sm rounded-xl px-3.5 py-2.5 active:bg-umber/15 disabled:opacity-40"
          >
            {savingFix ? "Mentés…" : fixSaved ? "Fixként mentve ✓" : "Mentés fix rendelésként"}
          </button>
        </div>

        {!hasFix && (
          <p className="text-xs text-faint">
            Ehhez a bolthoz nincs fix rendelés erre a napra.
          </p>
        )}

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted">Korábbi rendelései</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.map((entry) => (
                <button
                  key={entry.orderDate}
                  type="button"
                  onClick={() => onApplyHistory(entry)}
                  className="shrink-0 border bg-umber/8 border-umber/40 rounded-xl px-3.5 py-2.5 text-sm text-left active:bg-umber/15"
                >
                  <div className="font-medium">{formatShortDate(entry.orderDate)}</div>
                  <div className="text-muted text-xs">
                    {entry.totalQuantity} db · {formatFt(entry.totalValueFt)}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-faint">
              Koppints egy korábbi napra a betöltéshez — utána még szabadon módosíthatod.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => {
            const qty = column[item.itemId] ?? 0;
            return (
              <div
                key={item.itemId}
                className={`border rounded-xl bg-surface shadow-sm p-3 flex flex-col gap-2 ${
                  qty > 0 ? "border-gold" : "border-surface-border"
                }`}
              >
                <div>
                  <div className="text-sm font-medium leading-tight">{item.shortLabel}</div>
                  <div className="text-xs text-faint">{formatFt(item.price)}</div>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onSetQuantity(item.itemId, qty - 1)}
                    disabled={qty === 0}
                    aria-label={`${item.name} csökkentés`}
                    className="w-9 h-9 shrink-0 rounded-lg border bg-umber/8 border-umber/40 font-semibold active:bg-umber/15 disabled:opacity-40"
                  >
                    −
                  </button>
                  <EditableQty
                    value={qty}
                    onCommit={(value) => onSetQuantity(item.itemId, value)}
                    ariaLabel={`${item.name} mennyiség`}
                    placeholder="0"
                    className="flex-1 text-center font-semibold py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => onSetQuantity(item.itemId, qty + 1)}
                    aria-label={`${item.name} növelés`}
                    className="w-9 h-9 shrink-0 rounded-lg border bg-umber/8 border-umber/40 font-semibold active:bg-umber/15"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <StoreSettingsPanel
          store={store}
          date={date}
          weekday={weekday}
          onGroupChanged={(storeGroup) => onGroupChanged(store.customerId, storeGroup)}
          onRemoved={onRemoved}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="font-semibold">{totalQuantity} db</span>
            <span className="text-muted"> · {formatFt(totalValue)}</span>
            {totalValue > 0 && totalValue < MIN_ORDER_VALUE_FT && (
              <span className="block text-xs text-umber-dark">
                A minimális rendelés {formatFt(MIN_ORDER_VALUE_FT)} — ez csak jelzés.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-gold text-ink font-semibold px-5 py-2.5 rounded-xl active:bg-gold-dark"
          >
            Kész
          </button>
        </div>
      </div>
    </div>
  );
}
