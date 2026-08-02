import { prisma } from "@/lib/db";
import { rangeBetween, toDayStr } from "@/lib/dates";

export type SummaryRow = {
  ingredientId: string;
  name: string;
  unit: string;
  unitPrice: number;
  order: number;
  totalQuantity: number;
  totalValue: number;
};

export async function getSummary(fromStr: string, toStr: string) {
  const { gte, lt } = rangeBetween(fromStr, toStr);

  const grouped = await prisma.entry.groupBy({
    by: ["ingredientId"],
    where: { date: { gte, lt } },
    _sum: { quantity: true },
  });

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: grouped.map((g) => g.ingredientId) } },
  });
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const rows: SummaryRow[] = grouped
    .map((g) => {
      const ingredient = byId.get(g.ingredientId);
      if (!ingredient) return null;
      const totalQuantity = g._sum.quantity ?? 0;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        unitPrice: ingredient.unitPrice,
        order: ingredient.order,
        totalQuantity,
        totalValue: totalQuantity * ingredient.unitPrice,
      };
    })
    .filter((r): r is SummaryRow => r !== null)
    .sort((a, b) => a.order - b.order);

  const grandTotal = rows.reduce((sum, r) => sum + r.totalValue, 0);

  return { rows, grandTotal };
}

// "Turnover" for ingredients isn't just entries dated within the month
// (getSummary above) - it's specifically what's actually been billed, i.e.
// entries covered by a BillingPeriod whose invoice was closed in this month.
// A BillingPeriod's own [from, to] range can fall in an earlier month than
// its closedAt (billing tends to lag behind usage), so this sums entries per
// closed period's own date range, not the report month's range.
export async function getBilledIngredientTotals(
  monthStart: string,
  monthEnd: string
): Promise<{ rows: SummaryRow[]; grandTotal: number }> {
  const { gte, lt } = rangeBetween(monthStart, monthEnd);
  const periods = await prisma.billingPeriod.findMany({ where: { closedAt: { gte, lt } } });
  if (periods.length === 0) return { rows: [], grandTotal: 0 };

  const quantityByIngredient = new Map<string, number>();
  for (const period of periods) {
    const periodRange = rangeBetween(toDayStr(period.from), toDayStr(period.to));
    const grouped = await prisma.entry.groupBy({
      by: ["ingredientId"],
      where: { date: { gte: periodRange.gte, lt: periodRange.lt } },
      _sum: { quantity: true },
    });
    for (const g of grouped) {
      quantityByIngredient.set(
        g.ingredientId,
        (quantityByIngredient.get(g.ingredientId) ?? 0) + (g._sum.quantity ?? 0)
      );
    }
  }

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: Array.from(quantityByIngredient.keys()) } },
  });
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const rows: SummaryRow[] = Array.from(quantityByIngredient.entries())
    .map(([ingredientId, totalQuantity]) => {
      const ingredient = byId.get(ingredientId);
      if (!ingredient) return null;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        unitPrice: ingredient.unitPrice,
        order: ingredient.order,
        totalQuantity,
        totalValue: totalQuantity * ingredient.unitPrice,
      };
    })
    .filter((r): r is SummaryRow => r !== null)
    .sort((a, b) => b.totalValue - a.totalValue || a.name.localeCompare(b.name, "hu"));

  const grandTotal = rows.reduce((sum, r) => sum + r.totalValue, 0);
  return { rows, grandTotal };
}
