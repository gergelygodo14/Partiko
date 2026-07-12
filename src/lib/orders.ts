export type OrderDayQuantities = {
  a: number;
  b: number;
  c: number;
  aXl: number;
  bXl: number;
  cXl: number;
};
export type OrderLetter = "a" | "b" | "c";
export type OrderLineInput = { dayIndex: number; letter: string; quantity: number; isXl?: boolean };

// A normal-size A/B/C meal; an XL portion of the same dish costs more.
export const MEAL_PRICE_FT = 1200;
export const MEAL_PRICE_XL_FT = 1500;

export const ORDER_QUANTITY_FIELDS = ["a", "b", "c", "aXl", "bXl", "cXl"] as const;

// Ft value of one day's quantities, XL portions priced at MEAL_PRICE_XL_FT.
export function orderValue(day: OrderDayQuantities): number {
  const normal = day.a + day.b + day.c;
  const xl = day.aXl + day.bXl + day.cXl;
  return normal * MEAL_PRICE_FT + xl * MEAL_PRICE_XL_FT;
}

const FIELD_MAP: Record<OrderLetter, { normal: keyof OrderDayQuantities; xl: keyof OrderDayQuantities }> = {
  a: { normal: "a", xl: "aXl" },
  b: { normal: "b", xl: "bXl" },
  c: { normal: "c", xl: "cXl" },
};

export function quantityField(letter: OrderLetter, isXl: boolean): keyof OrderDayQuantities {
  const mapping = FIELD_MAP[letter];
  return isXl ? mapping.xl : mapping.normal;
}

// Renders one normal+XL quantity pair for display, e.g. "2 (+1 XL)", "+1 XL"
// (normal-only is just the bare number), or "" when both are zero.
export function formatCell(normal: number, xl: number): string {
  if (normal === 0 && xl === 0) return "";
  if (xl === 0) return String(normal);
  if (normal === 0) return `+${xl} XL`;
  return `${normal} (+${xl} XL)`;
}

export function emptyOrderWeek(): OrderDayQuantities[] {
  return Array.from({ length: 5 }, () => ({ a: 0, b: 0, c: 0, aXl: 0, bXl: 0, cXl: 0 }));
}

export function orderLinesToDaysGrid(lines: OrderLineInput[]): OrderDayQuantities[] {
  const grid = emptyOrderWeek();
  for (const line of lines) {
    if (line.dayIndex < 0 || line.dayIndex > 4) continue;
    const mapping = FIELD_MAP[line.letter as OrderLetter];
    if (!mapping) continue;
    const field = line.isXl ? mapping.xl : mapping.normal;
    grid[line.dayIndex][field] = line.quantity;
  }
  return grid;
}

export function daysGridToOrderLines(
  days: OrderDayQuantities[]
): { dayIndex: number; letter: OrderLetter; quantity: number; isXl: boolean }[] {
  const lines: { dayIndex: number; letter: OrderLetter; quantity: number; isXl: boolean }[] = [];
  days.forEach((day, dayIndex) => {
    (["a", "b", "c"] as const).forEach((letter) => {
      const { normal, xl } = FIELD_MAP[letter];
      if (day[normal] > 0) lines.push({ dayIndex, letter, quantity: day[normal], isXl: false });
      if (day[xl] > 0) lines.push({ dayIndex, letter, quantity: day[xl], isXl: true });
    });
  });
  return lines;
}

export function isValidOrderDays(value: unknown): value is OrderDayQuantities[] {
  if (!Array.isArray(value) || value.length !== 5) return false;
  return value.every((day) => {
    if (typeof day !== "object" || day === null) return false;
    const d = day as Record<string, unknown>;
    return ORDER_QUANTITY_FIELDS.every((key) => {
      const v = d[key];
      return typeof v === "number" && Number.isInteger(v) && v >= 0;
    });
  });
}

// A resubmission must not overwrite quantities of a day that's already
// locked (already passed within the current week) - the client may still
// send its (stale) view of those days, so the server re-applies whatever
// was already stored for them regardless of what was submitted.
export function applyLockedDays(
  submitted: OrderDayQuantities[],
  existing: OrderDayQuantities[],
  lockedDayIndexes: number[]
): OrderDayQuantities[] {
  const locked = new Set(lockedDayIndexes);
  return submitted.map((day, i) => (locked.has(i) ? existing[i] : day));
}
