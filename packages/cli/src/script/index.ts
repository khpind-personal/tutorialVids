import pLimit from "p-limit";
import { writeNarration } from "./writer.js";
import { directScene } from "./director.js";
import { loadAgentPrompt } from "../llm/prompts.js";
import { hashInputs } from "../cache/hash.js";
import type { Plan, Segment } from "../plan/types.js";
import type { ScanResult, PageEntry } from "../scan/types.js";
import type { SceneJson } from "./types.js";
import type { Config } from "../config/schema.js";

export interface RunScriptInput {
  plan: Plan;
  scan: ScanResult;
  config: Config;
  pluginRoot: string;
}

export interface ScriptArtifact {
  scene: SceneJson;
  hash: string;
}

function pageActionsFor(seg: Segment, scan: ScanResult): PageEntry["primary_actions"] {
  return scan.pages.find((p) => p.id === seg.page_id)?.primary_actions ?? [];
}

export async function runScript(input: RunScriptInput): Promise<ScriptArtifact[]> {
  const writerAgent = await loadAgentPrompt(input.pluginRoot, "tutorialvid-script-writer");
  const directorAgent = await loadAgentPrompt(input.pluginRoot, "tutorialvid-scene-director");
  const limit = pLimit(input.config.anthropic.max_concurrency);
  const apiKeyEnv = input.config.anthropic.api_key_env;
  const model = input.config.anthropic.model;
  const language = input.plan.language;

  const tasks = input.plan.segments.map((segment) =>
    limit(async () => {
      const page_actions = pageActionsFor(segment, input.scan);
      const w = await writeNarration({
        agent: writerAgent, segment, page_actions,
        base_url: input.scan.base_url, language, apiKeyEnv, model
      });
      const d = await directScene({
        agent: directorAgent, segment, page_actions, narration: w.narration, apiKeyEnv, model
      });
      const hash = hashInputs({
        segment_id: segment.id, depth: segment.depth, tone: segment.tone,
        narration_text: w.narration.text, actions_count: d.scene.actions.length
      });
      return { scene: d.scene, hash };
    })
  );
  return Promise.all(tasks);
}
