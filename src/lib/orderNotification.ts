import { formatCell, orderValue, quantityField, type OrderDayQuantities } from "@/lib/orders";

const DAY_LABELS = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];
const LETTERS = ["a", "b", "c"] as const;

export function buildOrderNotificationText(params: {
  storeName: string;
  weekStart: string;
  weekEnd: string;
  days: OrderDayQuantities[];
  isNew: boolean;
}): string {
  const { storeName, weekStart, weekEnd, days, isNew } = params;

  const dayLines = days
    .map((day, i) => {
      const parts = LETTERS.map((letter) => {
        const cell = formatCell(day[quantityField(letter, false)], day[quantityField(letter, true)]);
        return cell ? `${letter.toUpperCase()}: ${cell}` : null;
      }).filter((p): p is string => p !== null);
      return parts.length > 0 ? `${DAY_LABELS[i]}: ${parts.join(", ")}` : null;
    })
    .filter((line): line is string => line !== null);

  const totalMeals = days.reduce(
    (sum, day) => sum + LETTERS.reduce((s, l) => s + day[l] + day[quantityField(l, true)], 0),
    0
  );
  const totalValue = days.reduce((sum, day) => sum + orderValue(day), 0);

  const title = isNew ? "🆕 Új rendelés" : "✏️ Módosított rendelés";
  const body = dayLines.length > 0 ? dayLines.join("\n") : "(nincs tétel)";

  return (
    `${title} – ${storeName}\n` +
    `${weekStart} – ${weekEnd}\n\n` +
    `${body}\n\n` +
    `Összesen: ${totalMeals} adag, ${totalValue.toLocaleString("hu-HU")} Ft`
  );
}
