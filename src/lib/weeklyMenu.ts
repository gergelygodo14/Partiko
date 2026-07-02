export type MenuDay = {
  a: string;
  aGM: boolean;
  b: string;
  bGM: boolean;
  c: string;
  cGM: boolean;
};

export const DAY_NAMES = ["HÉTFŐ", "KEDD", "SZERDA", "CSÜTÖRTÖK", "PÉNTEK"] as const;

export function emptyDay(): MenuDay {
  return { a: "", aGM: false, b: "", bGM: false, c: "", cGM: false };
}

export function emptyWeek(): MenuDay[] {
  return DAY_NAMES.map(() => emptyDay());
}
