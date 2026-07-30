import { FULL_DAY_NAMES } from "@/lib/weekdays";

const MAX_LISTED_STORES = 3;

export type SandwichBulkEntryNotification = {
  date: string;
  weekday: number;
  changedStoreNames: string[];
  storeCount: number;
  totalQuantity: number;
  totalValueFt: number;
};

/** Telegram text for one bulk order-entry save.
 *
 *  One aggregate message per save, not one per store: a full day is ~30 stores,
 *  and Telegram rate-limits to roughly one message per second per chat, so a
 *  per-store loop would take half a minute and risk failing the request. The
 *  existing per-order notification exists to tell the owner that a CUSTOMER
 *  changed something; staff entry is not that signal.
 *
 *  Returns null when nothing actually changed, so pressing send repeatedly
 *  while fixing a typo does not spam. */
export function buildSandwichBulkEntryNotificationText(
  params: SandwichBulkEntryNotification
): string | null {
  const { date, weekday, changedStoreNames, storeCount, totalQuantity, totalValueFt } = params;

  if (changedStoreNames.length === 0) return null;

  const dayName = FULL_DAY_NAMES[weekday] ?? "";
  const listed = changedStoreNames.slice(0, MAX_LISTED_STORES).join(", ");
  const remainder = changedStoreNames.length - MAX_LISTED_STORES;
  const changedLine = remainder > 0 ? `${listed} +${remainder}` : listed;

  return [
    `📋 Rendelésfelvétel – ${dayName} (${date})`.trim(),
    `${storeCount} bolt · ${totalQuantity} db · ${totalValueFt.toLocaleString("hu-HU")} Ft`,
    `Módosult: ${changedLine}`,
  ].join("\n");
}
