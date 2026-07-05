export type OrderDayQuantities = { a: number; b: number; c: number };
export type OrderLetter = "a" | "b" | "c";
export type OrderLineInput = { dayIndex: number; letter: string; quantity: number };

export function emptyOrderWeek(): OrderDayQuantities[] {
  return Array.from({ length: 5 }, () => ({ a: 0, b: 0, c: 0 }));
}

export function orderLinesToDaysGrid(lines: OrderLineInput[]): OrderDayQuantities[] {
  const grid = emptyOrderWeek();
  for (const line of lines) {
    if (line.dayIndex < 0 || line.dayIndex > 4) continue;
    if (line.letter === "a" || line.letter === "b" || line.letter === "c") {
      grid[line.dayIndex][line.letter] = line.quantity;
    }
  }
  return grid;
}

export function daysGridToOrderLines(
  days: OrderDayQuantities[]
): { dayIndex: number; letter: OrderLetter; quantity: number }[] {
  const lines: { dayIndex: number; letter: OrderLetter; quantity: number }[] = [];
  days.forEach((day, dayIndex) => {
    (["a", "b", "c"] as const).forEach((letter) => {
      const quantity = day[letter];
      if (quantity > 0) lines.push({ dayIndex, letter, quantity });
    });
  });
  return lines;
}

export function isValidOrderDays(value: unknown): value is OrderDayQuantities[] {
  if (!Array.isArray(value) || value.length !== 5) return false;
  return value.every((day) => {
    if (typeof day !== "object" || day === null) return false;
    const d = day as Record<string, unknown>;
    return (["a", "b", "c"] as const).every((letter) => {
      const v = d[letter];
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
