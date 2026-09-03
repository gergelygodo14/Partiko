// UNUSED as of 2026-09-03 - both callers (dishSuggestion.ts,
// invoiceProcessing.ts) switched back to the direct Anthropic API
// (src/lib/anthropic.ts) now that ANTHROPIC_API_KEY has credit again.
// Deliberately left in place, same as OPENROUTER_API_KEY in .env.local, in
// case that key runs out again and this needs to come back quickly.
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

// Same model as before the 2026-08-05 switch, just billed from the
// OpenRouter balance instead of the direct Anthropic API credit.
export const OPENROUTER_MODEL = "anthropic/claude-sonnet-5";

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function attemptCompletion(params: {
  apiKey: string;
  content: OpenRouterContentPart[];
  maxTokens: number;
  timeoutMs?: number;
}): Promise<string> {
  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    signal: params.timeoutMs !== undefined ? AbortSignal.timeout(params.timeoutMs) : undefined,
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: params.maxTokens,
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
    // finish_reason ("length" = ran out of max_tokens, often mid-reasoning
    // for a thinking-capable model) is the main diagnostic signal here -
    // included so a repeat of this failure is readable from the error
    // banner the caller shows, not just from Vercel's server logs.
    const reason = data?.choices?.[0]?.finish_reason;
    throw new Error(
      `Az AI nem adott vissza szöveges választ${reason ? ` (finish_reason: ${reason})` : ""}`
    );
  }
  return text;
}

// Every caller needs a JSON reply parsed with JSON.parse, so this always asks
// for JSON mode and appends a blunt instruction on top of the schema each
// caller already describes in its own prompt text - structured-output
// enforcement (like the old output_config json_schema) isn't uniformly
// supported across OpenRouter providers, so the belt-and-braces prompt
// instruction is what actually keeps this reliable.
//
// `timeoutMs`/`maxAttempts` are opt-in (default: no timeout, single attempt -
// unchanged from before this option existed) because a shared, aggressive
// default would risk breaking invoiceProcessing.ts's vision calls, which can
// legitimately run long. Added after two real production failures on the
// dish-suggestion caller (2026-08-13): an empty-content response, then (after
// raising max_tokens to fix that) a request that ran the full 60s and got
// killed by Vercel's own platform timeout - a bare 504 that never reaches
// our JSON error handling. Both looked like one-off upstream flakiness
// (OpenRouter can route to a slow/stuck provider instance), not something
// max_tokens alone can fix - a bounded per-attempt timeout plus one retry
// aborts a stuck attempt well before Vercel's hard cutoff (so a clean JSON
// error makes it back to the caller) and gives a one-off flake a second try.
export async function openRouterJsonCompletion(params: {
  content: OpenRouterContentPart[];
  maxTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY nincs beállítva");
  }

  const maxAttempts = params.maxAttempts ?? 1;
  let lastError = new Error("Ismeretlen hiba");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await attemptCompletion({
        apiKey,
        content: params.content,
        maxTokens: params.maxTokens ?? 4096,
        timeoutMs: params.timeoutMs,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastError =
        isTimeout && params.timeoutMs !== undefined
          ? new Error(`OpenRouter nem válaszolt ${Math.round(params.timeoutMs / 1000)} másodpercen belül`)
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (attempt < maxAttempts) {
        console.error(`OpenRouter completion attempt ${attempt}/${maxAttempts} failed, retrying:`, lastError.message);
      }
    }
  }
  throw lastError;
}
