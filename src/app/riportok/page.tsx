"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDaysStr, addMonthsStr, mondayOf, monthStartOf, todayStr } from "@/lib/dates";
import {
  computeItemTrends,
  rankItems,
  type ItemQuantityRow,
  type ItemTrendRow,
} from "@/lib/reportAnalytics";

type SandwichMonthlyItemProfit = {
  itemId: string;
  itemName: string;
  quantity: number;
  profitPerUnitFt: number;
  totalProfitFt: number;
};
type SandwichProfitReport = {
  items: SandwichMonthlyItemProfit[];
  totalProfitFt: number;
};

type MealProfitReport = { totalMeals: number; totalProfitFt: number };

type SandwichMonthSummary = { byItem: ItemQuantityRow[]; totalValueFt: number };
type MealMonthSummary = { totalMeals: number; totalValue: number };

type DishAverageRow = { name: string; quantity: number; aboveAverage: boolean; belowAverage: boolean };
type DishBreakdownReport = { averageQuantity: number; dishes: DishAverageRow[] };

type BilledIngredientRow = {
  ingredientId: string;
  name: string;
  unit: string;
  profitPerUnit: number | null;
  totalQuantity: number;
  totalValue: number;
};
type BilledIngredientReport = { rows: BilledIngredientRow[]; grandTotal: number };

type IngredientProfitRow = {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
  profitPerUnitFt: number;
  totalProfitFt: number;
};
type IngredientProfitReport = { rows: IngredientProfitRow[]; totalProfitFt: number };

// Ingredient profit isn't fetched separately - the billed-ingredient report
// (ingredientSummary) already carries profitPerUnit per row, so this just
// multiplies it through. Rows without a tracked margin (profitPerUnit null,
// e.g. Jégsaláta/Paradicsom/Marha) are excluded rather than treated as 0,
// since "not tracked" and "confirmed zero margin" aren't the same thing.
function computeIngredientProfit(summary: BilledIngredientReport | null): IngredientProfitReport | null {
  if (!summary) return null;
  const rows: IngredientProfitRow[] = summary.rows
    .filter((r) => r.profitPerUnit !== null && r.totalQuantity > 0)
    .map((r) => ({
      ingredientId: r.ingredientId,
      name: r.name,
      unit: r.unit,
      quantity: r.totalQuantity,
      profitPerUnitFt: r.profitPerUnit as number,
      totalProfitFt: r.totalQuantity * (r.profitPerUnit as number),
    }))
    .sort((a, b) => b.totalProfitFt - a.totalProfitFt);
  return { rows, totalProfitFt: rows.reduce((sum, r) => sum + r.totalProfitFt, 0) };
}

function formatMonthLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
  });
}

function formatFt(value: number) {
  return `${value.toLocaleString("hu-HU")} Ft`;
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

function TurnoverCard({
  sandwichValueFt,
  mealValue,
  ingredientValueFt,
}: {
  sandwichValueFt: number | null;
  mealValue: number | null;
  ingredientValueFt: number | null;
}) {
  const combined = (sandwichValueFt ?? 0) + (mealValue ?? 0) + (ingredientValueFt ?? 0);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Forgalom</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Szendvics</div>
          <div className="text-2xl font-semibold">
            {sandwichValueFt !== null ? formatFt(sandwichValueFt) : "…"}
          </div>
        </div>
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Készétel</div>
          <div className="text-2xl font-semibold">
            {mealValue !== null ? formatFt(mealValue) : "…"}
          </div>
        </div>
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Alapanyagok</div>
          <div className="text-2xl font-semibold">
            {ingredientValueFt !== null ? formatFt(ingredientValueFt) : "…"}
          </div>
          <div className="text-xs text-faint">leszámlázva ebben a hónapban</div>
        </div>
      </div>
      <div className="border border-gold bg-gold/10 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <span className="text-sm font-medium">Összesen</span>
        <span className="font-semibold text-lg">{formatFt(combined)}</span>
      </div>
    </section>
  );
}

function ProfitCards({
  sandwichProfit,
  mealProfit,
  ingredientProfit,
}: {
  sandwichProfit: SandwichProfitReport | null;
  mealProfit: MealProfitReport | null;
  ingredientProfit: IngredientProfitReport | null;
}) {
  const combined =
    (sandwichProfit?.totalProfitFt ?? 0) +
    (mealProfit?.totalProfitFt ?? 0) +
    (ingredientProfit?.totalProfitFt ?? 0);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Havi nyereség</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Szendvics</div>
          <div className="text-2xl font-semibold">
            {sandwichProfit ? formatFt(sandwichProfit.totalProfitFt) : "…"}
          </div>
        </div>
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Készétel</div>
          <div className="text-2xl font-semibold">
            {mealProfit ? formatFt(mealProfit.totalProfitFt) : "…"}
          </div>
          {mealProfit && (
            <div className="text-xs text-faint">{mealProfit.totalMeals} adag × 500 Ft</div>
          )}
        </div>
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-sm text-muted">Alapanyagok</div>
          <div className="text-2xl font-semibold">
            {ingredientProfit ? formatFt(ingredientProfit.totalProfitFt) : "…"}
          </div>
          <div className="text-xs text-faint">csak a nyereséggel megadott alapanyagokból</div>
        </div>
      </div>
      <div className="border border-gold bg-gold/10 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <span className="text-sm font-medium">Összesen</span>
        <span className="font-semibold text-lg">{formatFt(combined)}</span>
      </div>

      {sandwichProfit && sandwichProfit.items.length > 0 && (
        <details className="border border-surface-border bg-surface rounded-2xl overflow-hidden shadow-sm">
          <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">
            Szendvics nyereség szendvicsenként
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-muted">
                <tr>
                  <th className="text-left px-3 py-2.5">Szendvics</th>
                  <th className="text-right px-3 py-2.5">Db</th>
                  <th className="text-right px-3 py-2.5">Haszon/db</th>
                  <th className="text-right px-3 py-2.5">Összesen</th>
                </tr>
              </thead>
              <tbody>
                {sandwichProfit.items.map((item) => (
                  <tr key={item.itemId} className="border-t border-surface-border">
                    <td className="px-3 py-2.5">{item.itemName}</td>
                    <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right">{formatFt(item.profitPerUnitFt)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatFt(item.totalProfitFt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {ingredientProfit && ingredientProfit.rows.length > 0 && (
        <details className="border border-surface-border bg-surface rounded-2xl overflow-hidden shadow-sm">
          <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">
            Alapanyag nyereség alapanyagonként
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-muted">
                <tr>
                  <th className="text-left px-3 py-2.5">Alapanyag</th>
                  <th className="text-right px-3 py-2.5">Mennyiség</th>
                  <th className="text-right px-3 py-2.5">Haszon/egység</th>
                  <th className="text-right px-3 py-2.5">Összesen</th>
                </tr>
              </thead>
              <tbody>
                {ingredientProfit.rows.map((row) => (
                  <tr key={row.ingredientId} className="border-t border-surface-border">
                    <td className="px-3 py-2.5">{row.name}</td>
                    <td className="px-3 py-2.5 text-right">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatFt(row.profitPerUnitFt)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatFt(row.totalProfitFt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function RankList({
  title,
  items,
  unitById,
}: {
  title: string;
  items: ItemQuantityRow[];
  unitById?: Record<string, string>;
}) {
  return (
    <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nincs elég adat.</p>
      ) : (
        <ul className="text-sm divide-y divide-surface-border">
          {items.map((item) => (
            <li key={item.itemId} className="flex items-center justify-between py-1.5">
              <span>{item.itemName}</span>
              <span className="font-medium">
                {item.quantity} {unitById?.[item.itemId] ?? "db"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendRow({ row, unitById }: { row: ItemTrendRow; unitById?: Record<string, string> }) {
  const unit = unitById?.[row.itemId] ?? "db";
  const label =
    row.changePercent === null
      ? row.direction === "up"
        ? "Új tétel"
        : "Teljesen elmaradt"
      : `${row.changePercent > 0 ? "+" : ""}${row.changePercent.toFixed(0)}%`;
  return (
    <li className="flex items-center justify-between py-1.5 text-sm">
      <span>{row.itemName}</span>
      <span className="flex items-center gap-2">
        <span className="text-faint">
          {row.previousQuantity} {unit} → {row.currentQuantity} {unit}
        </span>
        <span
          className={`font-semibold ${row.direction === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {row.direction === "up" ? "📈" : "📉"} {label}
        </span>
      </span>
    </li>
  );
}

function SandwichAnalytics({
  topItems,
  bottomItems,
  trends,
  loading,
}: {
  topItems: ItemQuantityRow[];
  bottomItems: ItemQuantityRow[];
  trends: ItemTrendRow[];
  loading: boolean;
}) {
  const growing = trends.filter((t) => t.direction === "up");
  const declining = trends.filter((t) => t.direction === "down");

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Szendvics elemzés</h2>
      {loading ? (
        <p className="text-muted">Betöltés...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RankList title="Legjobban fogyott" items={topItems} />
            <RankList title="Legkevésbé fogyott" items={bottomItems} />
          </div>
          <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-2">
            <div className="text-sm font-medium">Jelentős változás az előző hónaphoz képest</div>
            {growing.length === 0 && declining.length === 0 ? (
              <p className="text-sm text-muted">Nincs kiugró változás (±30%, min. 5 db felett).</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {[...growing, ...declining].map((row) => (
                  <TrendRow key={row.itemId} row={row} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function DishAnalytics({ report, loading }: { report: DishBreakdownReport | null; loading: boolean }) {
  if (loading || !report) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Készétel elemzés</h2>
        <p className="text-muted">Betöltés...</p>
      </section>
    );
  }

  const above = report.dishes
    .filter((d) => d.aboveAverage)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const below = report.dishes
    .filter((d) => d.belowAverage)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Készétel elemzés</h2>
      {report.dishes.length === 0 ? (
        <p className="text-muted">Nincs adat erre a hónapra.</p>
      ) : (
        <>
          <p className="text-xs text-faint">
            Átlagos rendelt mennyiség fogásonként ebben a hónapban: {report.averageQuantity.toFixed(1)} db
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-2">
              <div className="text-sm font-medium">Átlag feletti fogások</div>
              {above.length === 0 ? (
                <p className="text-sm text-muted">Nincs.</p>
              ) : (
                <ul className="text-sm divide-y divide-surface-border">
                  {above.map((d) => (
                    <li key={d.name} className="flex items-center justify-between py-1.5">
                      <span>{d.name}</span>
                      <span className="font-medium">{d.quantity} db</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-2">
              <div className="text-sm font-medium">Átlag alatti fogások</div>
              {below.length === 0 ? (
                <p className="text-sm text-muted">Nincs.</p>
              ) : (
                <ul className="text-sm divide-y divide-surface-border">
                  {below.map((d) => (
                    <li key={d.name} className="flex items-center justify-between py-1.5">
                      <span>{d.name}</span>
                      <span className="font-medium">{d.quantity} db</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function IngredientAnalytics({
  mode,
  onModeChange,
  monthLabel,
  weekStart,
  onWeekNav,
  trends,
  unitById,
  loading,
}: {
  mode: "month" | "week";
  onModeChange: (mode: "month" | "week") => void;
  monthLabel: string;
  weekStart: string;
  onWeekNav: (direction: -1 | 1) => void;
  trends: ItemTrendRow[];
  unitById: Record<string, string>;
  loading: boolean;
}) {
  const growing = trends.filter((t) => t.direction === "up");
  const declining = trends.filter((t) => t.direction === "down");
  const periodLabel =
    mode === "month" ? monthLabel : `${formatDate(weekStart)} – ${formatDate(addDaysStr(weekStart, 6))}`;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Alapanyag elemzés</h2>

      <div className="flex rounded-xl border border-umber/40 overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => onModeChange("month")}
          className={`flex-1 px-3 py-2 font-medium ${mode === "month" ? "bg-gold text-ink" : "active:bg-umber/15"}`}
        >
          Havi
        </button>
        <button
          type="button"
          onClick={() => onModeChange("week")}
          className={`flex-1 px-3 py-2 font-medium border-l border-umber/40 ${mode === "week" ? "bg-gold text-ink" : "active:bg-umber/15"}`}
        >
          Heti
        </button>
      </div>

      {mode === "week" && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onWeekNav(-1)}
            className="px-3 py-2 rounded-xl border bg-umber/8 border-umber/40 text-sm font-semibold active:bg-umber/15"
          >
            ◀ Előző hét
          </button>
          <span className="text-sm text-muted">{periodLabel}</span>
          <button
            type="button"
            onClick={() => onWeekNav(1)}
            className="px-3 py-2 rounded-xl border bg-umber/8 border-umber/40 text-sm font-semibold active:bg-umber/15"
          >
            Következő hét ▶
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Betöltés...</p>
      ) : (
        <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-2">
          <div className="text-sm font-medium">
            Előző (leszámlázott) {mode === "month" ? "hónaphoz" : "héthez"} képest
            {mode === "month" && (
              <span className="font-normal text-muted capitalize"> — {periodLabel}</span>
            )}
          </div>
          {growing.length === 0 && declining.length === 0 ? (
            <p className="text-sm text-muted">
              Nincs kiugró változás, vagy nem volt leszámlázás mindkét időszakban.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {[...growing, ...declining].map((row) => (
                <TrendRow key={row.itemId} row={row} unitById={unitById} />
              ))}
            </ul>
          )}
          <p className="text-xs text-faint">
            Mennyiség szerinti összevetés (nem Ft-ban), mindig ugyanahhoz az alapanyaghoz képest -
            a különböző mértékegységek (kg, db, liter) emiatt nem keverednek össze.
          </p>
        </div>
      )}
    </section>
  );
}

export default function RiportokPage() {
  const [reportMonth, setReportMonth] = useState(() => monthStartOf(todayStr()));

  const [sandwichSummary, setSandwichSummary] = useState<SandwichMonthSummary | null>(null);
  const [mealSummary, setMealSummary] = useState<MealMonthSummary | null>(null);
  const [ingredientSummary, setIngredientSummary] = useState<BilledIngredientReport | null>(null);
  const [sandwichProfit, setSandwichProfit] = useState<SandwichProfitReport | null>(null);
  const [mealProfit, setMealProfit] = useState<MealProfitReport | null>(null);
  const [dishBreakdown, setDishBreakdown] = useState<DishBreakdownReport | null>(null);
  const [sandwichLoading, setSandwichLoading] = useState(true);
  const [topItems, setTopItems] = useState<ItemQuantityRow[]>([]);
  const [bottomItems, setBottomItems] = useState<ItemQuantityRow[]>([]);
  const [trends, setTrends] = useState<ItemTrendRow[]>([]);
  const [ingredientTrends, setIngredientTrends] = useState<ItemTrendRow[]>([]);
  const [ingredientUnitById, setIngredientUnitById] = useState<Record<string, string>>({});
  const [ingredientLoading, setIngredientLoading] = useState(true);
  const [ingredientMode, setIngredientMode] = useState<"month" | "week">("month");
  const [ingredientWeekStart, setIngredientWeekStart] = useState(() => mondayOf(todayStr()));

  useEffect(() => {
    setSandwichSummary(null);
    setMealSummary(null);
    setIngredientSummary(null);
    setSandwichProfit(null);
    setMealProfit(null);
    setDishBreakdown(null);
    setSandwichLoading(true);

    (async () => {
      const res = await fetch(`/api/sandwich-orders/monthly-profit?month=${reportMonth}`);
      setSandwichProfit(await res.json());
    })();

    (async () => {
      const res = await fetch(`/api/orders/monthly-profit?month=${reportMonth}`);
      setMealProfit(await res.json());
    })();

    (async () => {
      const res = await fetch(`/api/orders/monthly-summary?month=${reportMonth}`);
      setMealSummary(await res.json());
    })();

    (async () => {
      const res = await fetch(`/api/orders/dish-breakdown?month=${reportMonth}`);
      setDishBreakdown(await res.json());
    })();

    (async () => {
      const previousMonth = addMonthsStr(reportMonth, -1);
      const [currentRes, previousRes] = await Promise.all([
        fetch(`/api/sandwich-orders/monthly-summary?month=${reportMonth}`),
        fetch(`/api/sandwich-orders/monthly-summary?month=${previousMonth}`),
      ]);
      const current = (await currentRes.json()) as SandwichMonthSummary;
      const previous = (await previousRes.json()) as SandwichMonthSummary;
      setSandwichSummary(current);
      const { topItems: top, bottomItems: bottom } = rankItems(current.byItem);
      setTopItems(top);
      setBottomItems(bottom);
      setTrends(computeItemTrends(current.byItem, previous.byItem));
      setSandwichLoading(false);
    })();

    (async () => {
      const res = await fetch(`/api/summary/billed?month=${reportMonth}`);
      setIngredientSummary(await res.json());
    })();
  }, [reportMonth]);

  // Separate from the effect above: the ingredient trend section has its own
  // month/week toggle, independent of the page's shared month selector (the
  // Forgalom card above always stays monthly, driven by reportMonth alone).
  useEffect(() => {
    setIngredientLoading(true);

    (async () => {
      const [currentUrl, previousUrl] =
        ingredientMode === "week"
          ? [
              `/api/summary/billed?week=${ingredientWeekStart}`,
              `/api/summary/billed?week=${addDaysStr(ingredientWeekStart, -7)}`,
            ]
          : [
              `/api/summary/billed?month=${reportMonth}`,
              `/api/summary/billed?month=${addMonthsStr(reportMonth, -1)}`,
            ];
      const [currentRes, previousRes] = await Promise.all([fetch(currentUrl), fetch(previousUrl)]);
      const current = (await currentRes.json()) as BilledIngredientReport;
      const previous = (await previousRes.json()) as BilledIngredientReport;

      const unitById: Record<string, string> = {};
      for (const row of [...current.rows, ...previous.rows]) unitById[row.ingredientId] = row.unit;
      setIngredientUnitById(unitById);

      const toItemRows = (rows: BilledIngredientRow[]): ItemQuantityRow[] =>
        rows.map((r) => ({ itemId: r.ingredientId, itemName: r.name, quantity: r.totalQuantity }));
      // Lower volume floor than the sandwich default (5) - ingredient units
      // (kg, liter, db) vary too much for one absolute number to fit all of
      // them, and a low floor here still lets the 30% threshold do the real
      // noise filtering.
      setIngredientTrends(
        computeItemTrends(toItemRows(current.rows), toItemRows(previous.rows), { minQuantity: 2 })
      );
      setIngredientLoading(false);
    })();
  }, [ingredientMode, reportMonth, ingredientWeekStart]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setReportMonth(addMonthsStr(reportMonth, -1))}
          className="px-3 py-2.5 rounded-xl border bg-umber/8 border-umber/40 text-sm font-semibold active:bg-umber/15"
        >
          ◀ Előző hónap
        </button>
        <span className="text-sm text-muted capitalize">{formatMonthLabel(reportMonth)}</span>
        <button
          onClick={() => setReportMonth(addMonthsStr(reportMonth, 1))}
          className="px-3 py-2.5 rounded-xl border bg-umber/8 border-umber/40 text-sm font-semibold active:bg-umber/15"
        >
          Következő hónap ▶
        </button>
      </div>

      <TurnoverCard
        sandwichValueFt={sandwichSummary?.totalValueFt ?? null}
        mealValue={mealSummary?.totalValue ?? null}
        ingredientValueFt={ingredientSummary?.grandTotal ?? null}
      />
      <ProfitCards
        sandwichProfit={sandwichProfit}
        mealProfit={mealProfit}
        ingredientProfit={computeIngredientProfit(ingredientSummary)}
      />
      <SandwichAnalytics
        topItems={topItems}
        bottomItems={bottomItems}
        trends={trends}
        loading={sandwichLoading}
      />
      <DishAnalytics report={dishBreakdown} loading={!dishBreakdown} />
      <IngredientAnalytics
        mode={ingredientMode}
        onModeChange={setIngredientMode}
        monthLabel={formatMonthLabel(reportMonth)}
        weekStart={ingredientWeekStart}
        onWeekNav={(direction) => setIngredientWeekStart(addDaysStr(ingredientWeekStart, direction * 7))}
        trends={ingredientTrends}
        unitById={ingredientUnitById}
        loading={ingredientLoading}
      />

      <Link
        href="/rendelesek"
        className="inline-block text-sm font-bold text-umber-dark bg-umber/10 border border-umber/50 rounded-full px-3.5 py-1.5 active:bg-umber/20"
      >
        ← Vissza a rendelésekhez
      </Link>
    </div>
  );
}
