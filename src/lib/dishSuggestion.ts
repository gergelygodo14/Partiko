import Anthropic from "@anthropic-ai/sdk";
import { REAL_DISH_EXAMPLES } from "@/lib/realDishExamples";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-5";
const SAMPLE_SIZE = 40;

const DISH_SCHEMA = {
  type: "object",
  properties: {
    dish: { type: "string" },
  },
  required: ["dish"],
  additionalProperties: false,
} as const;

export function sampleExamples(count: number, pool: string[] = REAL_DISH_EXAMPLES): string[] {
  const remaining = [...pool];
  const sample: string[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    sample.push(remaining.splice(idx, 1)[0]);
  }
  return sample;
}

export function buildSuggestionPrompt(examples: string[], avoidDishes: string[]): string {
  const avoidText = avoidDishes.map((d) => d.trim()).filter(Boolean).join(", ") || "nincs";
  return (
    "Egy magyarországi gyorsétteremhez (Partiko, csirke-alapú házias ételek) kell egy ÚJ heti menü " +
    "fogás ötlet, ugyanabban a stílusban, mint az alábbi valós, korábban használt fogásnevek:\n\n" +
    examples.join("\n") +
    `\n\nEzen a héten már szerepel (ne javasolj ehhez nagyon hasonlót vagy ugyanazt): ${avoidText}\n\n` +
    "Írj egyetlen ÚJ, még nem használt fogásnevet, pontosan olyan stílusban (rövid, tömör, magyar, a fő " +
    "alapanyaggal és köret/elkészítési móddal), mint a példák. Csak a fogás nevét add vissza, semmi mást."
  );
}

export async function suggestDish(avoidDishes: string[]): Promise<string> {
  const examples = sampleExamples(SAMPLE_SIZE);
  const prompt = buildSuggestionPrompt(examples, avoidDishes);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: DISH_SCHEMA } },
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Az AI nem adott vissza szöveges választ");
  }
  const parsed = JSON.parse(textBlock.text) as { dish: string };
  return parsed.dish;
}
