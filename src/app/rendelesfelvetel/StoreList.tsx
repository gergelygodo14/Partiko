"use client";

import type { GridTotals } from "@/lib/sandwichGridState";
import { groupStoresForGrid, STORE_GROUP_LABELS } from "@/lib/sandwichStoreGroups";
import type { GridStore } from "./types";
import { formatFt } from "./types";

/** The phone-first alternative to the matrix: one card per store, grouped the
 *  same way, tap to open the full-screen editor.
 *
 *  This is the default below `sm` because typing into a horizontally scrolled
 *  sticky-column table is genuinely bad on a small touch screen - focusing a
 *  cell makes the browser scroll it into view and fight the sticky column, and
 *  only ~2 store columns fit at 390px. */
export default function StoreList({
  stores,
  totals,
  dirty,
  onOpenStore,
}: {
  stores: GridStore[];
  totals: GridTotals;
  dirty: Set<string>;
  onOpenStore: (customerId: string) => void;
}) {
  const blocks = groupStoresForGrid(stores);

  return (
    <div className="space-y-5">
      {blocks.map((block) => (
        <section key={block.group} className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
            {STORE_GROUP_LABELS[block.group]}
          </h2>
          <div className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-neutral-100">
            {block.stores.map((store) => {
              const total = totals.byStore[store.customerId];
              const quantity = total?.quantity ?? 0;
              return (
                <button
                  key={store.customerId}
                  type="button"
                  onClick={() => onOpenStore(store.customerId)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-neutral-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {store.storeName}
                      {dirty.has(store.customerId) && (
                        <span className="ml-1.5 text-umber-dark" aria-label="mentetlen">
                          ●
                        </span>
                      )}
                    </div>
                    {!store.onFixList && (
                      <div className="text-xs text-neutral-400">nincs fix rendelése erre a napra</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={quantity > 0 ? "font-semibold" : "text-neutral-300"}>
                      {quantity > 0 ? `${quantity} db` : "—"}
                    </div>
                    {quantity > 0 && (
                      <div className="text-xs text-neutral-500">{formatFt(total.valueFt)}</div>
                    )}
                  </div>
                  <span className="text-neutral-300">›</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
