import Anthropic from "@anthropic-ai/sdk";
import type { AgentPrompt, DispatchResult } from "./types.js";

export interface DispatchOpts {
  agent: AgentPrompt;
  user: string;
  apiKeyEnv: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMP = 0.5;
const DEFAULT_RETRY_DELAY = 500;
const DEFAULT_MAX_RETRIES = 3;

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Shape returned by messages.create — typed locally because the installed
 *  SDK version (0.32.x) predates prompt-caching fields in its types. */
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  model: string;
  stop_reason?: string;
}

export async function dispatch(opts: DispatchOpts): Promise<DispatchResult> {
  const apiKey = process.env[opts.apiKeyEnv];
  if (!apiKey) throw new Error(`${opts.apiKeyEnv} is not set`);

  const client = new Anthropic({ apiKey });
  const model = opts.agent.model ?? opts.model;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY;

  // Build the request body as an untyped record so we can include
  // cache_control without fighting SDK types that lag the API version.
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMP,
    system: [
      { type: "text", text: opts.agent.system, cache_control: { type: "ephemeral" } }
    ],
    messages: [{ role: "user", content: opts.user }]
  };

  let attempt = 0;
  while (true) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = (await (client.messages.create as (b: unknown) => Promise<unknown>)(body)) as AnthropicResponse;
      const textBlock = resp.content.find((b) => b.type === "text");
      const text = textBlock?.text ?? "";
      const { usage } = resp;
      return {
        text,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        ...(usage.cache_read_input_tokens !== undefined
          ? { cacheReadTokens: usage.cache_read_input_tokens }
          : {}),
        ...(usage.cache_creation_input_tokens !== undefined
          ? { cacheCreationTokens: usage.cache_creation_input_tokens }
          : {}),
        model: resp.model,
        stopReason: resp.stop_reason ?? "unknown"
      };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== undefined && RETRYABLE.has(status) && attempt < maxRetries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
