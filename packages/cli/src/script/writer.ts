import { dispatch } from "../llm/anthropic.js";
import type { AgentPrompt, DispatchResult } from "../llm/types.js";
import type { Segment } from "../plan/types.js";
import type { ActionHint } from "../scan/types.js";
import type { Narration } from "./types.js";

export interface WriteNarrationInput {
  agent: AgentPrompt;
  segment: Segment;
  page_actions: ActionHint[];
  base_url: string;
  language: string;
  apiKeyEnv: string;
  model: string;
}

export interface WriteNarrationResult {
  narration: Narration;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number };
}

export async function writeNarration(input: WriteNarrationInput): Promise<WriteNarrationResult> {
  const userPayload = {
    segment: input.segment,
    page_actions: input.page_actions,
    base_url: input.base_url,
    language: input.language
  };
  const result: DispatchResult = await dispatch({
    agent: input.agent,
    user: JSON.stringify(userPayload),
    apiKeyEnv: input.apiKeyEnv,
    model: input.model
  });
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); }
  catch { throw new Error(`script-writer returned invalid JSON: ${result.text.slice(0, 200)}`); }
  const n = parsed as Partial<Narration>;
  if (!n || typeof n.text !== "string" || typeof n.ssml !== "string" || !Array.isArray(n.alignments)) {
    throw new Error(`script-writer returned malformed narration: missing text/ssml/alignments`);
  }
  return {
    narration: { text: n.text, ssml: n.ssml, alignments: n.alignments as Narration["alignments"] },
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ...(result.cacheReadTokens !== undefined ? { cacheReadTokens: result.cacheReadTokens } : {}),
      ...(result.cacheCreationTokens !== undefined ? { cacheCreationTokens: result.cacheCreationTokens } : {})
    }
  };
}
