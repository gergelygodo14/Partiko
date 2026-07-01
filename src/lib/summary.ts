import { prisma } from "@/lib/db";
import { rangeBetween } from "@/lib/dates";

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
