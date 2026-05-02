import { loadAgentPrompt } from "../llm/prompts.js";
import { writeWorkFile } from "./work-io.js";
import type { Plan, Segment } from "../plan/types.js";
import type { ScanResult, PageEntry } from "../scan/types.js";

export interface PrepareInput {
  plan: Plan;
  scan: ScanResult;
  pluginRoot: string;
  cacheRoot: string;
}

export interface PrepareOutput {
  workFiles: { segment_id: string; role: "writer" | "director"; path: string }[];
}

function pageActionsFor(seg: Segment, scan: ScanResult): PageEntry["primary_actions"] {
  return scan.pages.find((p) => p.id === seg.page_id)?.primary_actions ?? [];
}

export async function prepareWorkFiles(input: PrepareInput): Promise<PrepareOutput> {
  const writer = await loadAgentPrompt(input.pluginRoot, "tutorialvid-script-writer");
  const director = await loadAgentPrompt(input.pluginRoot, "tutorialvid-scene-director");
  const out: PrepareOutput["workFiles"] = [];

  for (const segment of input.plan.segments) {
    const page_actions = pageActionsFor(segment, input.scan);
    const writerPath = await writeWorkFile(input.cacheRoot, segment.id, "writer", {
      segment_id: segment.id,
      agent_name: writer.name,
      system_prompt: writer.system,
      user_payload: { segment, page_actions, base_url: input.scan.base_url, language: input.plan.language }
    });
    out.push({ segment_id: segment.id, role: "writer", path: writerPath });
    const directorPath = await writeWorkFile(input.cacheRoot, segment.id, "director", {
      segment_id: segment.id,
      agent_name: director.name,
      system_prompt: director.system,
      user_payload: { segment, page_actions, narration_result_file: `_result/${segment.id}.writer.json` }
    });
    out.push({ segment_id: segment.id, role: "director", path: directorPath });
  }
  return { workFiles: out };
}
