import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readResultFile, validateAuthorResult } from "./work-io.js";
import { hashInputs } from "../cache/hash.js";
import type { Segment } from "../plan/types.js";
import type { Narration, SceneAction, SceneJson } from "./types.js";

export interface ConsumeInput {
  segment: Segment;
  cacheRoot: string;
}

export interface ConsumeOutput {
  scene: SceneJson;
  hash: string;
  scenePath: string;
}

interface AuthorResult {
  narration: Narration;
  actions: SceneAction[];
}

export async function consumeSegmentResults(input: ConsumeInput): Promise<ConsumeOutput> {
  const authorPath = join(input.cacheRoot, "script", "_result", `${input.segment.id}.author.json`);
  let raw: AuthorResult;
  try {
    const parsed = await readResultFile<unknown>(authorPath);
    if (!validateAuthorResult(parsed)) throw new Error("malformed");
    raw = parsed as AuthorResult;
  } catch (err) {
    throw new Error(`author result for ${input.segment.id} missing or invalid: ${(err as Error).message}`);
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
    actions: raw.actions,
    narration: raw.narration
  };
  const hash = hashInputs({
    segment_id: scene.segment_id,
    role: scene.role,
    depth: scene.depth,
    tone: scene.tone,
    narration_text: raw.narration.text,
    actions_count: raw.actions.length
  });
  const segDir = join(input.cacheRoot, "script", input.segment.id);
  await mkdir(segDir, { recursive: true });
  const scenePath = join(segDir, `${hash}.scene.json`);
  await writeFile(scenePath, JSON.stringify(scene, null, 2), "utf8");
  await writeFile(join(segDir, `${hash}.txt`), raw.narration.text, "utf8");
  await writeFile(join(segDir, `${hash}.ssml`), raw.narration.ssml, "utf8");
  return { scene, hash, scenePath };
}
