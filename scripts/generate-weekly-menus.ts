// One-off content-generation script: schedules a year of weekly menus by
// reusing dish+köret combinations from ~2 years of historical menus
// (menu-corpus.json, extracted from Drive .doc files), respecting:
//  - no dish repeated within 14 days
//  - no two options on the same day sharing a köret (side dish)
//  - no two dishes sharing a named flavor/style (barbecue, grillezett, gyros, ...)
//    within 3 days of each other, so a style repeats at most twice a week and
//    only spaced out (e.g. Monday + Thursday), never on adjacent days
//  - seasonal fit (a dish is only placed near the months it historically appeared in)
// Run with --dry-run to preview without writing to the database.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type HistOption = { letter: string; text: string; gm: boolean };
type HistDay = { day: string; options: HistOption[] };
type HistWeek = {
  title: string;
  year: number;
  month: number;
  day: number;
  week: number;
  id: string;
  days: HistDay[];
};

const CORPUS_PATH = path.join(__dirname, "menu-corpus.json");

// Stems only (no suffix) so matching survives Hungarian case-suffix
// gemination/assimilation, e.g. "rizs" -> "rizzsel", "árpagyöngy" -> "árpagyönggyel".
const KORET_KEYWORDS: [string, string][] = [
  ["burgony", "burgonya"],
  ["krumpli", "burgonya"],
  ["pür", "burgonya"],
  ["riz", "rizs"], // also catches "rizott(ó)" - both are rice, treated as one bucket
  ["tészt", "teszta"],
  ["penn", "teszta"],
  ["spagett", "teszta"],
  ["makarón", "teszta"],
  ["metélt", "teszta"],
  ["galuska", "galuska"],
  ["nokedli", "galuska"],
  ["bulgur", "bulgur"],
  ["kuszkusz", "kuszkusz"],
  ["zöldség", "zoldseg"],
  ["salát", "salata"],
  ["árpagyö", "arpagyongy"],
];

// Named flavor/style identities, e.g. "Barbecue csirkecomb" and "Barbecue
// csirkemell" read as the same repeated dish to a customer even though the
// cut of meat differs. Only distinctive, named styles are listed here —
// generic cooking descriptors like "rántott"/"sült"/"sajtos"/"paprikás" are
// deliberately excluded since they're too common to treat as a signature
// flavor (constraining them would make the corpus infeasible).
const STYLE_KEYWORDS: [string, string][] = [
  ["barbecue", "barbecue"],
  ["grillezett", "grillezett"],
  ["gyros", "gyros"],
  ["hawaii", "hawaii"],
  ["kentucky", "kentucky"],
  ["buffalo", "buffalo"],
  ["mexikó", "mexikoi"],
  ["indiai", "indiai"],
  ["indonéz", "indonez"],
  ["milánói", "milanoi"],
  ["thai", "thai"],
  ["genovai", "genovai"],
  ["firenzei", "firenzei"],
  ["veronai", "veronai"],
  ["temesvári", "temesvari"],
  ["bakonyi", "bakonyi"],
  ["dubarry", "dubarry"],
  ["kijevi", "kijevi"],
  ["curry", "curry"],
  ["pizzaiola", "pizzaiola"],
  ["cajun", "cajun"],
  ["csőben sült", "csoben-sult"],
  ["egészben sült", "egeszben-sult"],
  ["mézes", "mezes"],
  ["tárkonyos", "tarkonyos"],
  ["koriander", "koriander"],
  ["vaslapos", "vaslapos"],
  ["sokmagvas", "sokmagvas"],
  ["rakott", "rakott"],
  ["magyaros", "magyaros"],
  ["párizsi", "parizsi"],
  ["pleskavica", "pleskavica"],
];

// A style tag may repeat at most every this many days, so it lands at most
// twice within a 5-day menu week and always spaced out (never adjacent days).
const MIN_STYLE_GAP_DAYS = 3;

function normalize(text: string): string {
  return text.normalize("NFD").toLowerCase();
}

function koretTags(text: string): Set<string> {
  const norm = normalize(text);
  const tags = new Set<string>();
  for (const [needle, tag] of KORET_KEYWORDS) {
    if (norm.includes(normalize(needle))) tags.add(tag);
  }
  return tags;
}

function styleTags(text: string): Set<string> {
  const norm = normalize(text);
  const tags = new Set<string>();
  for (const [needle, tag] of STYLE_KEYWORDS) {
    if (norm.includes(normalize(needle))) tags.add(tag);
  }
  return tags;
}

function monthDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const weeks: HistWeek[] = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));

  type Dish = {
    text: string;
    gm: boolean;
    months: Set<number>;
    korets: Set<string>;
    styles: Set<string>;
  };
  const dishMap = new Map<string, Dish>();
  for (const w of weeks) {
    for (const d of w.days) {
      for (const o of d.options) {
        const key = o.text;
        let dish = dishMap.get(key);
        if (!dish) {
          dish = {
            text: o.text,
            gm: o.gm,
            months: new Set(),
            korets: koretTags(o.text),
            styles: styleTags(o.text),
          };
          dishMap.set(key, dish);
        }
        dish.months.add(w.month);
      }
    }
  }
  const allDishes = [...dishMap.values()];
  console.log(`Loaded ${allDishes.length} unique historical dishes from ${weeks.length} weeks.`);

  const lastUsed = new Map<string, Date>(); // dish text -> last used date
  const styleLastUsed = new Map<string, Date>(); // style tag -> last used date
  const totalUseCount = new Map<string, number>();
  for (const d of allDishes) totalUseCount.set(d.text, 0);

  const START = mondayOf(new Date("2026-07-13T00:00:00Z"));
  const NUM_WEEKS = 52;
  const DAY_NAMES = ["HÉTFŐ", "KEDD", "SZERDA", "CSÜTÖRTÖK", "PÉNTEK"];

  const relaxationLog: string[] = [];

  function pickCandidates(
    targetDate: Date,
    monthWindow: number,
    minGapDays: number,
    enforceStyleGap: boolean
  ): Dish[] {
    const targetMonth = targetDate.getUTCMonth() + 1;
    return allDishes.filter((dish) => {
      const monthOk = [...dish.months].some((m) => monthDist(m, targetMonth) <= monthWindow);
      if (!monthOk) return false;
      const last = lastUsed.get(dish.text);
      if (last) {
        const gap = (targetDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        if (gap < minGapDays) return false;
      }
      if (enforceStyleGap) {
        for (const tag of dish.styles) {
          const lastStyle = styleLastUsed.get(tag);
          if (!lastStyle) continue;
          const gap = (targetDate.getTime() - lastStyle.getTime()) / (1000 * 60 * 60 * 24);
          if (gap < MIN_STYLE_GAP_DAYS) return false;
        }
      }
      return true;
    });
  }

  function chooseDay(targetDate: Date, dateLabel: string): { a: Dish; b: Dish; c: Dish } {
    let monthWindow = 1;
    let minGapDays = 15;
    let enforceStyleGap = true;
    let candidates = pickCandidates(targetDate, monthWindow, minGapDays, enforceStyleGap);

    while (candidates.length < 6 && monthWindow < 6) {
      monthWindow++;
      candidates = pickCandidates(targetDate, monthWindow, minGapDays, enforceStyleGap);
    }
    if (candidates.length < 6 && minGapDays > 7) {
      minGapDays = 7;
      relaxationLog.push(`${dateLabel}: relaxed min gap to 7 days (pool too small)`);
      candidates = pickCandidates(targetDate, monthWindow, minGapDays, enforceStyleGap);
    }
    if (candidates.length < 6 && enforceStyleGap) {
      enforceStyleGap = false;
      relaxationLog.push(`${dateLabel}: relaxed style-tag spacing (pool too small)`);
      candidates = pickCandidates(targetDate, monthWindow, minGapDays, enforceStyleGap);
    }
    if (candidates.length < 3) {
      relaxationLog.push(`${dateLabel}: relaxed to full-year pool, no gap constraint`);
      candidates = allDishes.slice();
    }

    // shuffle first so ties (e.g. equal usage count) break randomly, not alphabetically
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // then sort: least-used first (stable sort preserves the shuffle for ties)
    candidates.sort((x, y) => totalUseCount.get(x.text)! - totalUseCount.get(y.text)!);

    const chosen: Dish[] = [];
    const usedKorets = new Set<string>();
    const usedStylesToday = new Set<string>();
    for (const dish of candidates) {
      if (chosen.length === 3) break;
      const koretClash = [...dish.korets].some((k) => usedKorets.has(k));
      if (koretClash && dish.korets.size > 0) continue;
      const styleClash = [...dish.styles].some((s) => usedStylesToday.has(s));
      if (styleClash) continue;
      chosen.push(dish);
      for (const k of dish.korets) usedKorets.add(k);
      for (const s of dish.styles) usedStylesToday.add(s);
    }
    // fallback: if still short of 3 (all clash), fill ignoring köret/style constraints
    if (chosen.length < 3) {
      relaxationLog.push(
        `${dateLabel}: relaxed köret/style same-day uniqueness (not enough non-clashing options)`
      );
      for (const dish of candidates) {
        if (chosen.length === 3) break;
        if (!chosen.includes(dish)) chosen.push(dish);
      }
    }

    for (const dish of chosen) {
      lastUsed.set(dish.text, targetDate);
      totalUseCount.set(dish.text, totalUseCount.get(dish.text)! + 1);
      for (const s of dish.styles) styleLastUsed.set(s, targetDate);
    }

    return { a: chosen[0], b: chosen[1], c: chosen[2] };
  }

  type GeneratedDay = {
    a: string;
    aGM: boolean;
    b: string;
    bGM: boolean;
    c: string;
    cGM: boolean;
  };
  const result: { weekStart: string; days: GeneratedDay[] }[] = [];

  for (let w = 0; w < NUM_WEEKS; w++) {
    const weekStartDate = addDays(START, w * 7);
    const weekStartStr = toDayStr(weekStartDate);
    const days = [];
    for (let d = 0; d < 5; d++) {
      const date = addDays(weekStartDate, d);
      const label = `${weekStartStr} ${DAY_NAMES[d]}`;
      const { a, b, c } = chooseDay(date, label);
      days.push({
        a: a.text,
        aGM: a.gm,
        b: b.text,
        bGM: b.gm,
        c: c.text,
        cGM: c.gm,
      });
    }
    result.push({ weekStart: weekStartStr, days });
  }

  console.log(`Generated ${result.length} weeks.`);
  console.log(`Relaxation events: ${relaxationLog.length}`);
  relaxationLog.slice(0, 30).forEach((l) => console.log("  " + l));

  const unusedCount = allDishes.filter((d) => totalUseCount.get(d.text) === 0).length;
  console.log(`Dishes never used: ${unusedCount} / ${allDishes.length}`);
  const maxUse = Math.max(...[...totalUseCount.values()]);
  console.log(`Max times a single dish was reused: ${maxUse}`);

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    fs.writeFileSync(
      path.join(__dirname, "generated-menus-preview.json"),
      JSON.stringify(result, null, 2)
    );
    console.log("Saved generated-menus-preview.json for review. Dry run - not writing to database.");
    return;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  for (const week of result) {
    await prisma.weeklyMenu.upsert({
      where: { weekStart: new Date(`${week.weekStart}T00:00:00.000Z`) },
      update: { days: week.days },
      create: { weekStart: new Date(`${week.weekStart}T00:00:00.000Z`), days: week.days },
    });
  }
  console.log(`Wrote ${result.length} weeks to the database.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
