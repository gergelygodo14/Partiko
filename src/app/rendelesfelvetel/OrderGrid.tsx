"use client";

import EditableQty from "@/components/EditableQty";
import type { GridQuantities, GridTotals } from "@/lib/sandwichGridState";
import { groupStoresForGrid, STORE_GROUP_LABELS } from "@/lib/sandwichStoreGroups";
import type { GridItem, GridStore } from "./types";
import { formatFt } from "./types";

type Props = {
  items: GridItem[];
  stores: GridStore[];
  quantities: GridQuantities;
  totals: GridTotals;
  dirty: Set<string>;
  onSetQuantity: (customerId: string, itemId: string, quantity: number) => void;
  onOpenStore: (customerId: string) => void;
};

/** The Excel-style matrix: sandwiches down the rows, stores across the columns,
 *  exactly like the sheet this replaces.
 *
 *  Vidék renders as a physically separate table below the in-town one, mirroring
 *  the kitchen export's separate sheet - a divider column would not survive the
 *  horizontal scroll. */
export default function OrderGrid({
  items,
  stores,
  quantities,
  totals,
  dirty,
  onSetQuantity,
  onOpenStore,
}: Props) {
  const blocks = groupStoresForGrid(stores);
  const inTown = blocks.filter((block) => block.group !== "VIDEK");
  const videk = blocks.find((block) => block.group === "VIDEK");

  return (
    <div className="space-y-6">
      {inTown.length > 0 && (
        <GridTable
          caption="Városi körök"
          blocks={inTown}
          items={items}
          quantities={quantities}
          totals={totals}
          dirty={dirty}
          onSetQuantity={onSetQuantity}
          onOpenStore={onOpenStore}
        />
      )}

      {videk && (
        <GridTable
          caption="VIDÉK — külön kör"
          blocks={[videk]}
          items={items}
          quantities={quantities}
          totals={totals}
          dirty={dirty}
          onSetQuantity={onSetQuantity}
          onOpenStore={onOpenStore}
        />
      )}
    </div>
  );
}

function GridTable({
  caption,
  blocks,
  items,
  quantities,
  totals,
  dirty,
  onSetQuantity,
  onOpenStore,
}: Omit<Props, "stores"> & {
  caption: string;
  blocks: ReturnType<typeof groupStoresForGrid<GridStore>>;
}) {
  const columns = blocks.flatMap((block) => block.stores);
  if (columns.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">{caption}</h2>

      {/* Full-bleed from md up: 30 store columns need more than the shared
          layout's max-w-3xl. Below md the store list is the default view
          anyway, so the constrained width there is fine. */}
      <div className="md:relative md:left-1/2 md:w-screen md:-translate-x-1/2 md:px-4">
        <div className="border border-surface-border bg-surface rounded-2xl shadow-sm overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-surface-alt text-muted">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-[2] bg-surface-alt text-left px-3 py-2 align-bottom border-r border-strong min-w-[10rem]"
                >
                  Szendvics
                </th>
                {blocks.map((block) => (
                  <th
                    key={block.group}
                    colSpan={block.stores.length}
                    className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide border-l-2 border-strong"
                  >
                    {STORE_GROUP_LABELS[block.group]}
                  </th>
                ))}
                <th rowSpan={2} className="px-3 py-2 text-right align-bottom border-l-2 border-strong">
                  Össz.
                </th>
              </tr>
              <tr className="bg-surface-alt text-muted">
                {blocks.flatMap((block) =>
                  block.stores.map((store, i) => (
                    <th
                      key={store.customerId}
                      className={`px-1 py-2 align-bottom font-medium min-w-[3.5rem] ${
                        i === 0 ? "border-l-2 border-strong" : "border-l border-surface-border"
                      }`}
                    >
                      {/* Tapping a store header opens the single-store editor -
                          the escape hatch from cell-by-cell typing. */}
                      <button
                        type="button"
                        onClick={() => onOpenStore(store.customerId)}
                        className="w-full text-[11px] leading-tight break-words hover:underline active:opacity-70"
                        title={`${store.storeName} szerkesztése`}
                      >
                        {store.storeName}
                        {dirty.has(store.customerId) && (
                          <span className="block text-umber-dark" aria-label="mentetlen">
                            ●
                          </span>
                        )}
                      </button>
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.itemId} className="border-t border-surface-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-surface text-left font-normal px-3 py-1.5 whitespace-nowrap border-r border-strong"
                    title={item.name}
                  >
                    {item.shortLabel}
                  </th>
                  {blocks.flatMap((block) =>
                    block.stores.map((store, i) => (
                      <td
                        key={store.customerId}
                        className={`p-0 text-center ${
                          i === 0 ? "border-l-2 border-strong" : "border-l border-surface-border"
                        }`}
                      >
                        <EditableQty
                          value={quantities[store.customerId]?.[item.itemId] ?? 0}
                          onCommit={(value) => onSetQuantity(store.customerId, item.itemId, value)}
                          ariaLabel={`${store.storeName} – ${item.name}`}
                          placeholder="·"
                          className="w-full min-w-[3.5rem] px-1 py-1.5 text-center tabular-nums"
                        />
                      </td>
                    ))
                  )}
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted border-l-2 border-strong">
                    {totals.byItem[item.itemId] || ""}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-strong bg-surface-alt font-semibold">
                <th className="sticky left-0 z-[1] bg-surface-alt text-left px-3 py-2 border-r border-strong">
                  Összesen
                </th>
                {blocks.flatMap((block) =>
                  block.stores.map((store, i) => (
                    <td
                      key={store.customerId}
                      className={`px-1 py-2 text-center tabular-nums ${
                        i === 0 ? "border-l-2 border-strong" : "border-l border-surface-border"
                      }`}
                    >
                      {totals.byStore[store.customerId]?.quantity || ""}
                    </td>
                  ))
                )}
                <td className="px-3 py-2 text-right tabular-nums border-l-2 border-strong">
                  {columns.reduce(
                    (sum, store) => sum + (totals.byStore[store.customerId]?.quantity ?? 0),
                    0
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-1.5 px-1 text-xs text-faint md:px-0">
          Érték:{" "}
          {formatFt(
            columns.reduce((sum, store) => sum + (totals.byStore[store.customerId]?.valueFt ?? 0), 0)
          )}{" "}
          · koppints egy bolt nevére a teljes képernyős szerkesztéshez
        </p>
      </div>
    </section>
  );
}
