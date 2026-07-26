import { sandwichOrderTotalCount, sandwichOrderValueFt } from "@/lib/sandwichOrders";

export type SandwichOrderNotificationLine = {
  itemName: string;
  quantity: number;
  unitPriceFt: number;
};

export function buildSandwichOrderNotificationText(params: {
  storeName: string;
  orderDate: string;
  dayName: string;
  lines: SandwichOrderNotificationLine[];
  isNew: boolean;
}): string {
  const { storeName, orderDate, dayName, lines, isNew } = params;

  const itemLines = lines
    .filter((line) => line.quantity > 0)
    .map((line) => `${line.itemName}: ${line.quantity}`);

  const title = isNew ? "🆕 Új szendvics rendelés" : "✏️ Módosított szendvics rendelés";
  const body = itemLines.length > 0 ? itemLines.join("\n") : "(nincs tétel)";
  const totalCount = sandwichOrderTotalCount(lines);
  const totalValue = sandwichOrderValueFt(lines);

  return (
    `${title} – ${storeName}\n` +
    `${dayName} (${orderDate})\n\n` +
    `${body}\n\n` +
    `Összesen: ${totalCount} db, ${totalValue.toLocaleString("hu-HU")} Ft`
  );
}
