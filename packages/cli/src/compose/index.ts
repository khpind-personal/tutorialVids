import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import pLimit from "p-limit";
import { renderSegment } from "./render.js";
import { stitchFinal } from "./stitch.js";
import { applyWatermark, downscaleTo480p } from "./ffmpeg.js";
import { wordsToSrt } from "./srt.js";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";
import type { ComposeResult } from "./types.js";
import { logger } from "../logger.js";

export interface RunComposeInput {
  scenes: SceneJson[];
  cursors: Record<string, CursorTrack>;
  audioPaths: Record<string, string[]>;
  audioDurations: Record<string, number>;
  captionWords: Record<string, { word: string; start_ms: number; end_ms: number }[]>;
  rawClips: Record<string, string>;
  config: Config;
  pluginRoot: string;
  cacheRoot: string;
  appName: string;
}

export interface RunComposeOutput {
  segments: { id: string; mp4: string; duration_ms: number }[];
  draft_path: string;
  srt_path: string;
  total_duration_ms: number;
}

function parseRes(s: string): { width: number; height: number } {
  const [w, h] = s.split("x").map((n) => parseInt(n, 10));
  return { width: w!, height: h! };
}

export async function runCompose(input: RunComposeInput): Promise<RunComposeOutput> {
  const finalRes = parseRes(input.config.compose.final_resolution);
  const limit = pLimit(input.config.compose.parallel_segment_renders);

  const composedSegments: ComposeResult[] = [];
  await Promise.all(input.scenes.map((scene) => limit(async () => {
    const cursor = input.cursors[scene.segment_id];
    const audio = input.audioPaths[scene.segment_id] ?? [];
    const durMs = input.audioDurations[scene.segment_id] ?? scene.target_duration_s * 1000;
    const captions = input.captionWords[scene.segment_id] ?? [];
    const rawClip = input.rawClips[scene.segment_id];
    if (!cursor || !rawClip) {
      logger.warn({ segment: scene.segment_id }, "missing cursor or raw clip; skipping");
      return;
    }
    const cursorSvg = join(input.pluginRoot, "templates", "cursor", `${scene.tone}.svg`);
    const hash = hashInputs({ segment_id: scene.segment_id, duration_ms: durMs, audio_count: audio.length });
    const outPath = join(input.cacheRoot, "compose", scene.segment_id, `${hash}.mp4`);
    await mkdir(dirname(outPath), { recursive: true });
    const r = await renderSegment({
      scene, cursor,
      audio_paths: audio,
      audio_duration_ms: durMs,
      caption_words: captions,
      raw_clip_path: rawClip,
      out_path: outPath,
      resolution: finalRes,
      fps: input.config.compose.fps,
      cursor_svg_path: cursorSvg,
      cursor_size_px: input.config.compose.cursor_size_px,
      cursor_idle_hide_ms: input.config.compose.cursor_idle_hide_ms
    });
    composedSegments.push(r);
  })));

  composedSegments.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
  const segmentMp4s = composedSegments.map((s) => s.composed_mp4_path);

  let cursorMs = 0;
  const allWords: { word: string; start_ms: number; end_ms: number }[] = [];
  for (const seg of composedSegments) {
    const words = input.captionWords[seg.segment_id] ?? [];
    for (const w of words) allWords.push({ word: w.word, start_ms: cursorMs + w.start_ms, end_ms: cursorMs + w.end_ms });
    cursorMs += seg.duration_ms;
  }
  const srtTarget = join(input.cacheRoot, "final", "draft.srt");
  await mkdir(dirname(srtTarget), { recursive: true });
  await writeFile(srtTarget, wordsToSrt(allWords, 5), "utf8");

  const musicPath = input.config.compose.music_override_path
    ? input.config.compose.music_override_path
    : join(input.pluginRoot, "templates", "music", `${input.scenes[0]?.tone ?? "friendly"}.mp3`);

  const introTemplatePath = join(input.pluginRoot, "templates", "intro", `${input.config.compose.intro_template}.json`);
  const outroTemplatePath = join(input.pluginRoot, "templates", "outro", `${input.config.compose.outro_template}.json`);

  const workDir = join(input.cacheRoot, "compose", "_stitch");
  const stitchedHd = join(workDir, "stitched-hd.mp4");
  await stitchFinal({
    segmentMp4s,
    introTemplatePath, outroTemplatePath,
    musicPath, musicVolume: input.config.compose.music_volume,
    appName: input.appName,
    outroCta: input.config.compose.outro_cta,
    workDir,
    finalOut: stitchedHd,
    resolution: finalRes
  });

  const draftDir = join(input.cacheRoot, "final");
  await mkdir(draftDir, { recursive: true });
  const draftScaled = join(draftDir, "draft-no-wm.mp4");
  const draftFinal = join(draftDir, "draft.mp4");
  await downscaleTo480p(stitchedHd, draftScaled);
  await applyWatermark(draftScaled, draftFinal, input.config.compose.watermark_text);

  return {
    segments: composedSegments.map((s) => ({ id: s.segment_id, mp4: s.composed_mp4_path, duration_ms: s.duration_ms })),
    draft_path: draftFinal,
    srt_path: srtTarget,
    total_duration_ms: composedSegments.reduce((acc, s) => acc + s.duration_ms, 0)
  };
}
