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

// One meal (any A/B/C dish, XL or not) always costs the same flat price.
export const MEAL_PRICE_FT = 1200;

export const ORDER_QUANTITY_FIELDS = ["a", "b", "c", "aXl", "bXl", "cXl"] as const;

const FIELD_MAP: Record<OrderLetter, { normal: keyof OrderDayQuantities; xl: keyof OrderDayQuantities }> = {
  a: { normal: "a", xl: "aXl" },
  b: { normal: "b", xl: "bXl" },
  c: { normal: "c", xl: "cXl" },
};

export function quantityField(letter: OrderLetter, isXl: boolean): keyof OrderDayQuantities {
  const mapping = FIELD_MAP[letter];
  return isXl ? mapping.xl : mapping.normal;
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
