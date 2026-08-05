const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

// Same model as before the 2026-08-05 switch, just billed from the
// OpenRouter balance instead of the direct Anthropic API credit.
export const OPENROUTER_MODEL = "anthropic/claude-sonnet-5";

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

// Every caller needs a JSON reply parsed with JSON.parse, so this always asks
// for JSON mode and appends a blunt instruction on top of the schema each
// caller already describes in its own prompt text - structured-output
// enforcement (like the old output_config json_schema) isn't uniformly
// supported across OpenRouter providers, so the belt-and-braces prompt
// instruction is what actually keeps this reliable.
export async function openRouterJsonCompletion(params: {
  content: OpenRouterContentPart[];
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY nincs beállítva");
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: params.maxTokens ?? 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Kizárólag egy érvényes JSON objektummal válaszolj, a kért séma szerint. " +
            "Ne fűzz hozzá semmilyen más szöveget, magyarázatot vagy markdown code fence-t.",
        },
        { role: "user", content: params.content },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text) {
    throw new Error("Az AI nem adott vissza szöveges választ");
  }
  return text;
}
