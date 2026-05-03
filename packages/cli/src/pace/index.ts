import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SceneJson, SceneAction } from "../script/types.js";

export interface PaceConfig {
  intro_breath_ms: number;
  inter_phrase_breath_ms: number;
  pre_zoom_breath_ms: number;
  post_zoom_breath_ms: number;
  no_phrase_default_hold_ms: number;
  tail_breath_ms: number;
}

export const DEFAULT_PACE: PaceConfig = {
  intro_breath_ms: 200,
  inter_phrase_breath_ms: 350,
  pre_zoom_breath_ms: 250,
  post_zoom_breath_ms: 250,
  no_phrase_default_hold_ms: 2500,
  tail_breath_ms: 500
};

interface ChunkRow {
  index: number;
  mp3_path: string;
  duration_ms: number;
  action_t_ms?: number;
  phrase?: string;
  beat?: string;
}

interface TimingFile {
  mode?: "beat" | "chunked";
  duration_ms: number;
  timing: { word: string; start_ms: number; end_ms: number }[];
  chunks?: ChunkRow[];
}

export interface PaceSegmentInput {
  scriptDir: string;
  segmentId: string;
  config?: Partial<PaceConfig>;
}

export interface PaceSegmentResult {
  segment_id: string;
  paced: boolean;
  prior_target_ms: number;
  new_target_ms: number;
  beat_count: number;
}

function findChunkForAction(action: SceneAction, chunks: ChunkRow[]): ChunkRow | undefined {
  if (typeof action.narration_phrase !== "string") return undefined;
  const target = action.narration_phrase.trim();
  return chunks.find((c) => (c.phrase ?? "").trim() === target);
}

function isZoomBeat(a: SceneAction): boolean {
  return !!(a.zoom && a.zoom.scale && a.zoom.scale !== 1.0);
}

export async function paceSegment(input: PaceSegmentInput): Promise<PaceSegmentResult> {
  const cfg = { ...DEFAULT_PACE, ...(input.config ?? {}) };
  const segDir = input.scriptDir;
  const files = await readdir(segDir);
  const sceneFile = files.find((f) => f.endsWith(".scene.json"));
  if (!sceneFile) throw new Error(`no scene.json in ${segDir}`);
  const timingFile = files.find((f) => f.endsWith(".timing.json"));

  const scenePath = join(segDir, sceneFile);
  const scene = JSON.parse(await readFile(scenePath, "utf8")) as SceneJson;
  const priorTarget = scene.target_duration_s * 1000;

  let timing: TimingFile | null = null;
  let timingPath: string | null = null;
  if (timingFile) {
    timingPath = join(segDir, timingFile);
    timing = JSON.parse(await readFile(timingPath, "utf8")) as TimingFile;
  }

  const hasPhraseBeats = scene.actions.some((a) => typeof a.narration_phrase === "string" && a.narration_phrase.trim().length > 0);
  if (!hasPhraseBeats || !timing || !timing.chunks) {
    return { segment_id: input.segmentId, paced: false, prior_target_ms: priorTarget, new_target_ms: priorTarget, beat_count: 0 };
  }

  const sorted = [...scene.actions].sort((a, b) => a.t_ms - b.t_ms);
  const chunks = timing.chunks;
  const updatedChunks: ChunkRow[] = [];

  let cursor = 0;
  let beatCount = 0;
  let establishWideSeen = false;

  for (const a of sorted) {
    if (a.type === "nav") {
      a.t_ms = 0;
      continue;
    }

    const chunk = findChunkForAction(a, chunks);
    if (chunk) {
      const breath = !establishWideSeen ? cfg.intro_breath_ms : isZoomBeat(a) ? cfg.pre_zoom_breath_ms : cfg.inter_phrase_breath_ms;
      const start = cursor + (cursor === 0 ? 0 : breath);
      a.t_ms = start;
      const phraseDur = chunk.duration_ms;
      const tailBreath = isZoomBeat(a) ? cfg.post_zoom_breath_ms : 0;
      if (a.zoom) {
        a.zoom.hold_ms = phraseDur + tailBreath;
      }
      if (a.highlight) {
        a.highlight.duration_ms = phraseDur + tailBreath;
      }
      cursor = start + phraseDur + tailBreath;
      updatedChunks.push({ ...chunk, action_t_ms: start });
      beatCount++;
      establishWideSeen = true;
      continue;
    }

    if (a.type === "wait") {
      // No phrase: a tail or pacing pause beat. Keep small fixed hold.
      const hold = a.zoom?.hold_ms ?? cfg.no_phrase_default_hold_ms;
      const breath = establishWideSeen ? cfg.inter_phrase_breath_ms : cfg.intro_breath_ms;
      const start = cursor + (cursor === 0 ? 0 : breath);
      a.t_ms = start;
      if (a.zoom) a.zoom.hold_ms = Math.min(hold, cfg.no_phrase_default_hold_ms);
      cursor = start + (a.zoom?.hold_ms ?? cfg.no_phrase_default_hold_ms);
      establishWideSeen = true;
      continue;
    }

    // click / type fallthrough — leave as-is, just rebase t_ms.
    const breath = establishWideSeen ? cfg.inter_phrase_breath_ms : cfg.intro_breath_ms;
    a.t_ms = cursor + (cursor === 0 ? 0 : breath);
    cursor = a.t_ms + 500;
    establishWideSeen = true;
  }

  const totalMs = cursor + cfg.tail_breath_ms;
  scene.target_duration_s = Math.ceil(totalMs / 1000);
  scene.actions = sorted;

  await writeFile(scenePath, JSON.stringify(scene, null, 2), "utf8");

  if (timingPath) {
    const stableChunks: ChunkRow[] = chunks.map((c) => {
      const updated = updatedChunks.find((u) => u.index === c.index);
      return updated ?? c;
    }).sort((a, b) => (a.action_t_ms ?? 0) - (b.action_t_ms ?? 0));

    const newDuration = Math.max(...stableChunks.map((c) => (c.action_t_ms ?? 0) + c.duration_ms), 0);
    const newTiming: TimingFile = { ...timing, mode: "beat", duration_ms: newDuration, chunks: stableChunks };
    await writeFile(timingPath, JSON.stringify(newTiming, null, 2), "utf8");
  }

  return {
    segment_id: input.segmentId,
    paced: true,
    prior_target_ms: priorTarget,
    new_target_ms: scene.target_duration_s * 1000,
    beat_count: beatCount
  };
}
