import { prisma } from "@/lib/db";
import { addDaysStr, parseDay } from "@/lib/dates";
import type { MenuDay } from "@/lib/weeklyMenu";
import { openRouterJsonCompletion } from "@/lib/openrouter";

// How many neighboring weeks' dishes are off-limits (both before and after
// the week being edited), in addition to the current week - keeps the same
// dish from reappearing too soon. Forward weeks matter just as much as past
// ones here: almost every week already has real, saved content (see
// CLAUDE.md), so editing e.g. Friday without checking the following Monday
// (already-saved, in the next week's row) let the same dish land on two
// literally consecutive calendar days.
const LOOKBACK_WEEKS = 2;
const LOOKAHEAD_WEEKS = 2;

// Cap on how many candidates are sent to the model per suggestion. The
// catalog has 1000+ dishes; sending the whole remaining pool every click
// made each request slow for no benefit, since the model only ever needs to
// pick a handful and the pool is already shuffled (so capping doesn't bias
// which dishes can come up over repeated clicks).
const MAX_CANDIDATES = 60;

// How many options the AI button offers per click - lets the user pick one
// instead of re-clicking and waiting on a fresh round-trip for every retry.
export const SUGGESTION_COUNT = 3;

export function normalizeDishName(name: string): string {
  return name.trim().toLowerCase();
}

const COMBINING_MARKS_RE = /[̀-ͯ]/g;

// Word-set for near-duplicate detection - deliberately coarser than
// normalizeDishName's exact-match string, because the same real dish can
// show up as two different catalog rows from the two Drive migrations (see
// CLAUDE.md's "Második migráció"), e.g. "Carbonara spagetti" and "Spagetti
// carbonara reszelt sajttal" - different word order AND an extra
// descriptive suffix, so even exact-string or classic edit-distance
// (levenshtein) comparison wouldn't reliably catch them as the same dish.
function dishNameTokens(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFD")
      .replace(COMBINING_MARKS_RE, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

// True if the SHORTER name's words are (essentially) all present in the
// longer one - catches reordering and added modifiers/suffixes ("X" vs "Y X
// reszelt sajttal") without flagging genuinely different dishes, since those
// almost always differ in their defining word (the protein/main ingredient:
// "Rántott sertésszelet" vs "Rántott csirkemell" only share "rántott", not a
// full subset). Single-word names are exempted (too generic on their own -
// e.g. "Leves") to avoid false positives from one shared common word.
function isNearDuplicateDishName(a: string, b: string): boolean {
  const tokensA = dishNameTokens(a);
  const tokensB = dishNameTokens(b);
  const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  if (smaller.size < 2) return false;
  for (const token of smaller) {
    if (!larger.has(token)) return false;
  }
  return true;
}

// Removes anything already used (this week, or the lookback weeks) from the
// candidate pool - purely rule-based, no AI involved, so a real repeat can
// never slip through regardless of what the model picks. Exact-match first
// (cheap, and case/whitespace differences alone shouldn't need the fuzzier
// token check), then falls back to the near-duplicate word-set check above.
export function buildCandidatePool(allDishes: string[], excludeNames: string[]): string[] {
  const excludeSet = new Set(excludeNames.map(normalizeDishName));
  return allDishes.filter((d) => {
    if (excludeSet.has(normalizeDishName(d))) return false;
    return !excludeNames.some((excluded) => isNearDuplicateDishName(d, excluded));
  });
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildPickPrompt(
  candidates: string[],
  sameDayDishes: string[],
  weekDishes: string[] = [],
  count: number = SUGGESTION_COUNT
): string {
  const sameDayText = sameDayDishes.map((d) => d.trim()).filter(Boolean).join(", ") || "nincs";
  const weekText = weekDishes.map((d) => d.trim()).filter(Boolean).join(", ") || "nincs";
  return (
    `Egy magyarországi gyorsétteremhez (Partiko, csirke-alapú házias ételek) ${count} KÜLÖNBÖZŐ ` +
    "fogást kell kiválasztani, amik közül egy ember majd választ egyet - az alábbi, ténylegesen " +
    "létező, korábban már használt fogások listájából (0-tól indexelve, soronként egy fogás):\n\n" +
    candidates.map((c, i) => `${i}: ${c}`).join("\n") +
    `\n\nUgyanerre a napra a másik két fogás már el van döntve: ${sameDayText}\n\n` +
    "Nézd meg ennek a két fogásnak a körítését/alapját (pl. rizs, burgonya, tészta), és a listából " +
    "olyanokat válassz, aminek NEM ugyanaz a köret/alapja. Ha pl. már van egy rizses és egy " +
    "burgonyás/krumplis fogás, válassz inkább tésztaalapút vagy egytálételt, hogy a napi három fogás " +
    "köret szerint is változatos legyen.\n\n" +
    `A hét többi napján eddig ezek a fogások szerepelnek: ${weekText}\n\n` +
    "Ne válassz olyat, aminek a neve vagy alapötlete (pl. ugyanaz a régió/konyha stílusa, mint " +
    '"székelyes") már megjelenik ebben a listában, még akkor sem, ha a pontos név különbözik ' +
    '(pl. ha már szerepel "Székelygulyás", ne válassz "Székelykáposztát" se ugyanerre a hétre) - ' +
    "kerüld a szóismétlést és a tartalmi/témabeli hasonlóságot is, ne csak a pontos névegyezést.\n\n" +
    `A ${count} választott fogás EGYMÁSTÓL is különbözzön - se a nevük, se az alapötletük (köret, ` +
    "régió/stílus) ne legyen ugyanaz kettő között, hogy a végén tényleg legyen miből választani.\n\n" +
    "Kizárólag a fenti listából választhatsz - ne találj ki új fogást.\n\n" +
    'Válaszolj kizárólag egy JSON objektummal, pontosan ebben a formában: {"indices": [szám, szám, ...]} ' +
    `- pontosan ${count} db, egymástól különböző sorszám a fenti listából, semmi mást ne írj.`
  );
}

async function getNearbyWeekDishNames(weekStart: string): Promise<string[]> {
  const nearbyStarts = [
    ...Array.from({ length: LOOKBACK_WEEKS }, (_, i) => parseDay(addDaysStr(weekStart, -7 * (i + 1)))),
    ...Array.from({ length: LOOKAHEAD_WEEKS }, (_, i) => parseDay(addDaysStr(weekStart, 7 * (i + 1)))),
  ];
  const menus = await prisma.weeklyMenu.findMany({
    where: { weekStart: { in: nearbyStarts } },
  });
  return menus.flatMap((menu) => (menu.days as MenuDay[]).flatMap((d) => [d.a, d.b, d.c]));
}

export async function suggestDishes(params: {
  weekStart: string;
  avoidDishes: string[];
  sameDayDishes?: string[];
  weekDishes?: string[];
}): Promise<string[]> {
  const { weekStart, avoidDishes, sameDayDishes = [], weekDishes = [] } = params;

  const [allDishes, nearbyDishes] = await Promise.all([
    prisma.dish.findMany({ select: { name: true } }),
    getNearbyWeekDishNames(weekStart),
  ]);

  const shuffledPool = shuffle(
    buildCandidatePool(
      allDishes.map((d) => d.name),
      [...avoidDishes, ...nearbyDishes]
    )
  );
  if (shuffledPool.length === 0) {
    throw new Error("Nincs elérhető fogás a katalógusban, ami megfelelne a feltételeknek");
  }
  const candidates = shuffledPool.slice(0, MAX_CANDIDATES);

  const prompt = buildPickPrompt(candidates, sameDayDishes, weekDishes, SUGGESTION_COUNT);

  // 1024 (the original budget here) intermittently produced a hard failure
  // in production ("Az AI nem adott vissza szöveges választ", 2026-08-13,
  // confirmed via Vercel logs) - the visible JSON answer is tiny (3 indices),
  // but Sonnet can spend a chunk of max_tokens on hidden reasoning before
  // emitting it, especially with a 60-candidate list plus the variety/theme
  // instructions to weigh. Matches invoiceProcessing.ts's budget, which
  // hasn't shown this failure, rather than re-guessing a smaller number.
  const text = await openRouterJsonCompletion({
    maxTokens: 8192,
    content: [{ type: "text", text: prompt }],
  });
  const parsed = JSON.parse(text) as { indices: number[] };
  const pickedIndices = Array.isArray(parsed.indices) ? parsed.indices : [];

  const picks: string[] = [];
  const usedNames = new Set<string>();
  for (const idx of pickedIndices) {
    const name = candidates[idx];
    if (name === undefined) continue;
    const norm = normalizeDishName(name);
    if (usedNames.has(norm)) continue;
    usedNames.add(norm);
    picks.push(name);
    if (picks.length === SUGGESTION_COUNT) break;
  }
  // The model can return fewer than SUGGESTION_COUNT valid, unique picks (bad
  // index, duplicate, or it just ignored the count) - top up from the same
  // shuffled pool instead of round-tripping again, so the user reliably sees
  // SUGGESTION_COUNT real options from one click.
  if (picks.length < SUGGESTION_COUNT) {
    for (const name of shuffledPool) {
      if (picks.length === SUGGESTION_COUNT) break;
      const norm = normalizeDishName(name);
      if (usedNames.has(norm)) continue;
      usedNames.add(norm);
      picks.push(name);
    }
  }
  if (picks.length === 0) {
    throw new Error("Az AI nem adott vissza érvényes fogást");
  }
  return picks;
}
