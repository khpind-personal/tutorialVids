import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readResultFile, validateNarrationResult, validateSceneResult } from "./work-io.js";
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

export async function consumeSegmentResults(input: ConsumeInput): Promise<ConsumeOutput> {
  const writerPath = join(input.cacheRoot, "script", "_result", `${input.segment.id}.writer.json`);
  const directorPath = join(input.cacheRoot, "script", "_result", `${input.segment.id}.director.json`);

  let narration: Narration;
  try {
    const raw = await readResultFile<unknown>(writerPath);
    if (!validateNarrationResult(raw)) throw new Error("malformed");
    narration = raw as Narration;
  } catch (err) {
    throw new Error(`writer result for ${input.segment.id} missing or invalid: ${(err as Error).message}`);
  }

  let actions: SceneAction[];
  try {
    const raw = await readResultFile<{ actions?: SceneAction[] }>(directorPath);
    if (!validateSceneResult(raw)) throw new Error("empty actions");
    actions = raw.actions!;
  } catch (err) {
    throw new Error(`director result for ${input.segment.id} missing or invalid: ${(err as Error).message}`);
  }

  const scene: SceneJson = {
    segment_id: input.segment.id,
    page_id: input.segment.page_id,
    depth: input.segment.depth,
    tone: input.segment.tone,
    target_duration_s: input.segment.target_duration_s,
    actions,
    narration
  };
  const hash = hashInputs({ segment_id: scene.segment_id, depth: scene.depth, tone: scene.tone, narration_text: narration.text, actions_count: actions.length });
  const segDir = join(input.cacheRoot, "script", input.segment.id);
  await mkdir(segDir, { recursive: true });
  const scenePath = join(segDir, `${hash}.scene.json`);
  await writeFile(scenePath, JSON.stringify(scene, null, 2), "utf8");
  await writeFile(join(segDir, `${hash}.txt`), narration.text, "utf8");
  await writeFile(join(segDir, `${hash}.ssml`), narration.ssml, "utf8");
  return { scene, hash, scenePath };
}
