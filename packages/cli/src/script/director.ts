import { dispatch } from "../llm/anthropic.js";
import type { AgentPrompt, DispatchResult } from "../llm/types.js";
import type { Segment } from "../plan/types.js";
import type { ActionHint } from "../scan/types.js";
import type { Narration, SceneAction, SceneJson } from "./types.js";

export interface DirectSceneInput {
  agent: AgentPrompt;
  segment: Segment;
  page_actions: ActionHint[];
  narration: Narration;
  apiKeyEnv: string;
  model: string;
}

export interface DirectSceneResult {
  scene: SceneJson;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number };
}

export async function directScene(input: DirectSceneInput): Promise<DirectSceneResult> {
  const userPayload = {
    segment: input.segment,
    page_actions: input.page_actions,
    narration: input.narration
  };
  const result: DispatchResult = await dispatch({
    agent: input.agent,
    user: JSON.stringify(userPayload),
    apiKeyEnv: input.apiKeyEnv,
    model: input.model
  });
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); }
  catch { throw new Error(`scene-director returned invalid JSON: ${result.text.slice(0, 200)}`); }
  const a = (parsed as { actions?: SceneAction[] }).actions;
  if (!Array.isArray(a) || a.length === 0) {
    throw new Error(`scene-director returned empty or missing actions array`);
  }
  const scene: SceneJson = {
    segment_id: input.segment.id,
    page_id: input.segment.page_id,
    role: input.segment.role,
    ...(input.segment.role_label ? { role_label: input.segment.role_label } : {}),
    ...(input.segment.is_common ? { is_common: true } : {}),
    depth: input.segment.depth,
    tone: input.segment.tone,
    target_duration_s: input.segment.target_duration_s,
    actions: a,
    narration: input.narration
  };
  return {
    scene,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ...(result.cacheReadTokens !== undefined ? { cacheReadTokens: result.cacheReadTokens } : {}),
      ...(result.cacheCreationTokens !== undefined ? { cacheCreationTokens: result.cacheCreationTokens } : {})
    }
  };
}
