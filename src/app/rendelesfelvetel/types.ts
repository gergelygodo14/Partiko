import type { StoreGroup } from "@/generated/prisma/client";

export type GridItem = {
  itemId: string;
  name: string;
  shortLabel: string;
  order: number;
  price: number;
};

export type GridStore = {
  customerId: string;
  storeName: string;
  storeGroup: StoreGroup;
  storeOrder: number;
  onFixList: boolean;
  saved: Record<string, number>;
  fix: Record<string, number>;
};

export type DayGrid = {
  date: string;
  weekday: number;
  items: GridItem[];
  stores: GridStore[];
  savedAt: string | null;
};

export type DaySaveResult = {
  date: string;
  savedAt: string;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  deletedCount: number;
  changedStoreNames: string[];
  totalQuantity: number;
  totalValueFt: number;
};

export type HistoryEntry = {
  orderDate: string;
  lines: { itemId: string; itemName: string; quantity: number }[];
  totalQuantity: number;
  totalValueFt: number;
};

export function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatFt(value: number): string {
  return `${value.toLocaleString("hu-HU")} Ft`;
}
