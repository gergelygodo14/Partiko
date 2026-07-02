export function parseDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function dayRange(dateStr: string): { gte: Date; lt: Date } {
  const start = parseDay(dateStr);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export function rangeBetween(fromStr: string, toStr: string): { gte: Date; lt: Date } {
  const gte = parseDay(fromStr);
  const lt = parseDay(toStr);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDayStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = parseDay(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDayStr(d);
}

export function mondayOf(dateStr: string): string {
  const d = parseDay(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDayStr(d);
}
