import Anthropic from "@anthropic-ai/sdk";

// Back on the direct Anthropic API (2026-09-03) - the 2026-08-05 move to
// OpenRouter (src/lib/openrouter.ts, still around but unused now) was purely
// because the direct ANTHROPIC_API_KEY ran out of credit, not a design
// choice; a fresh key restores the original, faster path (structured
// json_schema output instead of OpenRouter's prompt-enforced JSON mode -
// the model doesn't have to spend tokens re-deriving the shape).
const anthropic = new Anthropic();
const MODEL = "claude-sonnet-5";

export type AnthropicContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function toAnthropicBlock(part: AnthropicContentPart): Anthropic.ContentBlockParam {
  if (part.type === "text") return { type: "text", text: part.text };
  return { type: "image", source: { type: "url", url: part.image_url.url } };
}

async function attemptCompletion(params: {
  content: AnthropicContentPart[];
  maxTokens: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-defined JSON Schema, shape varies per caller
  schema?: Record<string, any>;
  effort: "low" | "medium" | "high";
  timeoutMs?: number;
}): Promise<string> {
  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: params.maxTokens,
      thinking: { type: "adaptive" },
      output_config: params.schema
        ? { effort: params.effort, format: { type: "json_schema", schema: params.schema } }
        : { effort: params.effort },
      messages: [{ role: "user", content: params.content.map(toAnthropicBlock) }],
    } as Anthropic.MessageCreateParamsNonStreaming,
    params.timeoutMs !== undefined ? { timeout: params.timeoutMs } : undefined
  );

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    const reason = response.stop_reason;
    throw new Error(
      `Az AI nem adott vissza szöveges választ${reason ? ` (stop_reason: ${reason})` : ""}`
    );
  }
  return textBlock.text;
}

// Same interface as the retired openRouterJsonCompletion (src/lib/
// openrouter.ts) so both callers (dishSuggestion.ts, invoiceProcessing.ts)
// needed only an import swap plus their own JSON schema, not a rewrite.
// `timeoutMs`/`maxAttempts` are opt-in for the same reason they were added
// there: a shared aggressive default would risk breaking invoiceProcessing's
// vision calls, which can legitimately run long.
export async function anthropicJsonCompletion(params: {
  content: AnthropicContentPart[];
  maxTokens?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-defined JSON Schema, shape varies per caller
  schema?: Record<string, any>;
  effort?: "low" | "medium" | "high";
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  const maxAttempts = params.maxAttempts ?? 1;
  let lastError = new Error("Ismeretlen hiba");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await attemptCompletion({
        content: params.content,
        maxTokens: params.maxTokens ?? 4096,
        schema: params.schema,
        effort: params.effort ?? "medium",
        timeoutMs: params.timeoutMs,
      });
    } catch (error) {
      const isTimeout =
        error instanceof Anthropic.APIConnectionTimeoutError ||
        (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
      lastError =
        isTimeout && params.timeoutMs !== undefined
          ? new Error(`Az Anthropic API nem válaszolt ${Math.round(params.timeoutMs / 1000)} másodpercen belül`)
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (attempt < maxAttempts) {
        console.error(`Anthropic completion attempt ${attempt}/${maxAttempts} failed, retrying:`, lastError.message);
      }
    }
  }
  throw lastError;
}
