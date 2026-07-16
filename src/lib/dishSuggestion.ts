import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { addDaysStr, parseDay } from "@/lib/dates";
import type { MenuDay } from "@/lib/weeklyMenu";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-5";

// How many prior weeks' dishes are off-limits, in addition to the current
// week - keeps the same dish from reappearing too soon.
const LOOKBACK_WEEKS = 2;

const PICK_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
  },
  required: ["index"],
  additionalProperties: false,
} as const;

export function normalizeDishName(name: string): string {
  return name.trim().toLowerCase();
}

// Removes anything already used (this week, or the lookback weeks) from the
// candidate pool - purely string-based, no AI involved, so a real repeat can
// never slip through regardless of what the model picks.
export function buildCandidatePool(allDishes: string[], excludeNames: string[]): string[] {
  const excludeSet = new Set(excludeNames.map(normalizeDishName));
  return allDishes.filter((d) => !excludeSet.has(normalizeDishName(d)));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildPickPrompt(candidates: string[], sameDayDishes: string[]): string {
  const sameDayText = sameDayDishes.map((d) => d.trim()).filter(Boolean).join(", ") || "nincs";
  return (
    "Egy magyarországi gyorsétteremhez (Partiko, csirke-alapú házias ételek) EGY fogást kell " +
    "kiválasztani az alábbi, ténylegesen létező, korábban már használt fogások listájából " +
    "(0-tól indexelve, soronként egy fogás):\n\n" +
    candidates.map((c, i) => `${i}: ${c}`).join("\n") +
    `\n\nUgyanerre a napra a másik két fogás már el van döntve: ${sameDayText}\n\n` +
    "Nézd meg ennek a két fogásnak a körítését/alapját (pl. rizs, burgonya, tészta), és a listából " +
    "olyat válassz, aminek NEM ugyanaz a köret/alapja. Ha pl. már van egy rizses és egy " +
    "burgonyás/krumplis fogás, válassz inkább tésztaalapút vagy egytálételt, hogy a napi három fogás " +
    "köret szerint is változatos legyen.\n\n" +
    "Kizárólag a fenti listából választhatsz - ne találj ki új fogást. Csak a választott fogás " +
    "sorszámát (index) add vissza, semmi mást."
  );
}

async function getRecentDishNames(weekStart: string): Promise<string[]> {
  const lookbackStarts = Array.from({ length: LOOKBACK_WEEKS }, (_, i) =>
    parseDay(addDaysStr(weekStart, -7 * (i + 1)))
  );
  const menus = await prisma.weeklyMenu.findMany({
    where: { weekStart: { in: lookbackStarts } },
  });
  return menus.flatMap((menu) => (menu.days as MenuDay[]).flatMap((d) => [d.a, d.b, d.c]));
}

export async function suggestDish(params: {
  weekStart: string;
  avoidDishes: string[];
  sameDayDishes?: string[];
}): Promise<string> {
  const { weekStart, avoidDishes, sameDayDishes = [] } = params;

  const [allDishes, recentDishes] = await Promise.all([
    prisma.dish.findMany({ select: { name: true } }),
    getRecentDishNames(weekStart),
  ]);

  const candidates = shuffle(
    buildCandidatePool(
      allDishes.map((d) => d.name),
      [...avoidDishes, ...recentDishes]
    )
  );
  if (candidates.length === 0) {
    throw new Error("Nincs elérhető fogás a katalógusban, ami megfelelne a feltételeknek");
  }

  const prompt = buildPickPrompt(candidates, sameDayDishes);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: PICK_SCHEMA } },
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Az AI nem adott vissza szöveges választ");
  }
  const parsed = JSON.parse(textBlock.text) as { index: number };
  const picked = candidates[parsed.index];
  if (picked === undefined) {
    throw new Error("Az AI érvénytelen indexet adott vissza");
  }
  return picked;
}
