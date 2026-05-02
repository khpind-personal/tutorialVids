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

export interface RoleDraftOutput {
  role: string;
  draft_path: string;
  srt_path: string;
  segment_ids: string[];
  duration_ms: number;
}

export interface RunComposeOutput {
  segments: { id: string; role: string; mp4: string; duration_ms: number }[];
  drafts: RoleDraftOutput[];
  draft_path: string;
  srt_path: string;
  total_duration_ms: number;
}

function parseRes(s: string): { width: number; height: number } {
  const [w, h] = s.split("x").map((n) => parseInt(n, 10));
  return { width: w!, height: h! };
}

function safeRoleId(role: string): string {
  return role.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function runCompose(input: RunComposeInput): Promise<RunComposeOutput> {
  const finalRes = parseRes(input.config.compose.final_resolution);
  const limit = pLimit(input.config.compose.parallel_segment_renders);

  const composedSegments: (ComposeResult & { role: string })[] = [];
  await Promise.all(input.scenes.map((scene) => limit(async () => {
    const cursor = input.cursors[scene.segment_id];
    const audio = input.audioPaths[scene.segment_id] ?? [];
    const audioMs = input.audioDurations[scene.segment_id] ?? 0;
    const durMs = Math.max(audioMs, scene.target_duration_s * 1000);
    const captions = input.captionWords[scene.segment_id] ?? [];
    const rawClip = input.rawClips[scene.segment_id];
    if (!cursor || !rawClip) {
      logger.warn({ segment: scene.segment_id }, "missing cursor or raw clip; skipping");
      return;
    }
    const cursorSvg = join(input.pluginRoot, "templates", "cursor", `${scene.tone}.svg`);
    const hash = hashInputs({
      segment_id: scene.segment_id,
      role: scene.role,
      duration_ms: durMs,
      audio_count: audio.length
    });
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
    composedSegments.push({ ...r, role: scene.role });
  })));

  composedSegments.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

  const roleSet = new Set(composedSegments.map((s) => s.role).filter((r) => r !== "common"));
  const roles = roleSet.size === 0 ? ["common"] : [...roleSet];

  const introTemplatePath = join(input.pluginRoot, "templates", "intro", `${input.config.compose.intro_template}.json`);
  const outroTemplatePath = join(input.pluginRoot, "templates", "outro", `${input.config.compose.outro_template}.json`);
  const musicPath = input.config.compose.music_override_path
    ? input.config.compose.music_override_path
    : join(input.pluginRoot, "templates", "music", `${input.scenes[0]?.tone ?? "friendly"}.mp3`);

  const drafts: RoleDraftOutput[] = [];
  const draftDir = join(input.cacheRoot, "final");
  await mkdir(draftDir, { recursive: true });

  for (const role of roles) {
    const ordered = composedSegments
      .filter((s) => s.role === role || s.role === "common")
      .sort((a, b) => a.segment_id.localeCompare(b.segment_id));
    if (ordered.length === 0) continue;

    const segmentMp4s = ordered.map((s) => s.composed_mp4_path);

    let cursorMs = 0;
    const allWords: { word: string; start_ms: number; end_ms: number }[] = [];
    for (const seg of ordered) {
      const words = input.captionWords[seg.segment_id] ?? [];
      for (const w of words) allWords.push({ word: w.word, start_ms: cursorMs + w.start_ms, end_ms: cursorMs + w.end_ms });
      cursorMs += seg.duration_ms;
    }
    const safeRole = safeRoleId(role);
    const srtTarget = join(draftDir, `draft.${safeRole}.srt`);
    await writeFile(srtTarget, wordsToSrt(allWords, 5), "utf8");

    const workDir = join(input.cacheRoot, "compose", `_stitch_${safeRole}`);
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

    const draftScaled = join(draftDir, `draft-no-wm.${safeRole}.mp4`);
    const draftFinal = join(draftDir, `draft.${safeRole}.mp4`);
    await downscaleTo480p(stitchedHd, draftScaled);
    await applyWatermark(draftScaled, draftFinal, input.config.compose.watermark_text);

    drafts.push({
      role,
      draft_path: draftFinal,
      srt_path: srtTarget,
      segment_ids: ordered.map((s) => s.segment_id),
      duration_ms: cursorMs
    });
  }

  // Back-compat: top-level draft_path / srt_path point to first role's draft (or single-role case).
  const head = drafts[0];
  return {
    segments: composedSegments.map((s) => ({
      id: s.segment_id, role: s.role, mp4: s.composed_mp4_path, duration_ms: s.duration_ms
    })),
    drafts,
    draft_path: head?.draft_path ?? "",
    srt_path: head?.srt_path ?? "",
    total_duration_ms: composedSegments.reduce((acc, s) => acc + s.duration_ms, 0)
  };
}
