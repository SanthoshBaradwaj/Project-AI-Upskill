import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.PIVOT_MODEL ?? "claude-opus-5";

let cached: Anthropic | null = null;

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getClient(): Anthropic | null {
  if (!hasApiKey()) return null;
  if (!cached) cached = new Anthropic();
  return cached;
}

export class AgentUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AgentUnavailable";
  }
}

export interface JsonCallOptions {
  system: string;
  user: string;
  /** JSON Schema. Must set additionalProperties:false and list required keys. */
  schema: Record<string, unknown>;
  /**
   * Lower effort keeps us inside the latency budget (§7.6). Note that
   * `temperature` is deliberately absent — Claude Opus 5 rejects sampling
   * parameters with a 400, so generation variety is steered by prompting.
   */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * One schema-constrained call. Throws AgentUnavailable on missing key, timeout,
 * refusal, or unparseable output so every caller can fall back cleanly (P0-16).
 */
export async function callJSON<T>(opts: JsonCallOptions): Promise<T> {
  const client = getClient();
  if (!client) throw new AgentUnavailable("ANTHROPIC_API_KEY is not set");

  const timeoutMs = opts.timeoutMs ?? 20_000;

  let response;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        output_config: {
          effort: opts.effort ?? "medium",
          format: { type: "json_schema", schema: opts.schema },
        },
        messages: [{ role: "user", content: opts.user }],
      },
      { timeout: timeoutMs },
    );
  } catch (err) {
    throw new AgentUnavailable(
      err instanceof Error ? `${err.name}: ${err.message}` : "request failed",
    );
  }

  if (response.stop_reason === "refusal") {
    throw new AgentUnavailable("model declined the request");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AgentUnavailable("response truncated at max_tokens");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new AgentUnavailable("no text block in response");
  }

  try {
    return JSON.parse(text.text) as T;
  } catch {
    throw new AgentUnavailable("response was not valid JSON");
  }
}
