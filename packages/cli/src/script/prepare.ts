import { loadAgentPrompt } from "../llm/prompts.js";
import { writeWorkFile } from "./work-io.js";
import type { Plan, Segment } from "../plan/types.js";
import type { ScanResult, PageEntry } from "../scan/types.js";
import type { Discovery, RouteRoleCell } from "../discovery/types.js";

export interface PrepareInput {
  plan: Plan;
  scan: ScanResult;
  discovery?: Discovery;
  pluginRoot: string;
  cacheRoot: string;
}

export interface PrepareOutput {
  workFiles: { segment_id: string; role: "author"; path: string }[];
}

function pageActionsFor(seg: Segment, scan: ScanResult): PageEntry["primary_actions"] {
  return scan.pages.find((p) => p.id === seg.page_id)?.primary_actions ?? [];
}

function roleViewFor(seg: Segment, discovery?: Discovery): {
  role_id: string;
  role_label: string;
  title: string;
  dom_hash: string;
  unique_elements: string[];
} | null {
  if (!discovery || seg.is_common || seg.role === "common") return null;
  const cells: Record<string, RouteRoleCell> = discovery.route_role_matrix[seg.page_route] ?? {};
  const cell = cells[seg.role];
  if (!cell || !cell.accessible) return null;
  const role = discovery.roles.find((r) => r.id === seg.role);
  return {
    role_id: seg.role,
    role_label: role?.label ?? seg.role,
    title: cell.title ?? "",
    dom_hash: cell.dom_hash ?? "",
    unique_elements: cell.unique_elements ?? []
  };
}

export async function prepareWorkFiles(input: PrepareInput): Promise<PrepareOutput> {
  const author = await loadAgentPrompt(input.pluginRoot, "tutorialvid-segment-author");
  const out: PrepareOutput["workFiles"] = [];
  const corpus = input.discovery?.context_corpus ?? "";

  for (const segment of input.plan.segments) {
    const page_actions = pageActionsFor(segment, input.scan);
    const role_view = roleViewFor(segment, input.discovery);
    const path = await writeWorkFile(input.cacheRoot, segment.id, "author", {
      segment_id: segment.id,
      agent_name: author.name,
      system_prompt: author.system,
      user_payload: {
        segment,
        page_actions,
        role_view,
        context_corpus: corpus,
        base_url: input.scan.base_url,
        language: input.plan.language
      }
    });
    out.push({ segment_id: segment.id, role: "author", path });
  }
  return { workFiles: out };
}
