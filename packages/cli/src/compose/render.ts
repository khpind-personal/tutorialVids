import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComposeInput, ComposeResult } from "./types.js";
import { buildTimeline } from "./timeline.js";
import { logger } from "../logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(here, "../../src/compose-entry.tsx");

let bundled: string | null = null;

async function ensureBundle(): Promise<string> {
  if (bundled) return bundled;
  bundled = await bundle({ entryPoint: ENTRY });
  return bundled;
}

export async function renderSegment(input: ComposeInput): Promise<ComposeResult> {
  const bundleLocation = await ensureBundle();
  const timeline = buildTimeline({
    scene: input.scene,
    cursor: input.cursor,
    audio_duration_ms: input.audio_duration_ms
  });
  const inputProps = {
    rawClipPath: input.raw_clip_path,
    audioPaths: input.audio_paths,
    cursorTrack: input.cursor,
    cursorSvgPath: input.cursor_svg_path,
    cursorSize: input.cursor_size_px,
    cursorIdleHideMs: input.cursor_idle_hide_ms,
    keyframes: timeline.keyframes,
    captionWords: input.caption_words,
    durationMs: timeline.duration_ms
  };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Segment",
    inputProps
  });
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: input.out_path,
    inputProps
  });
  logger.info({ segment_id: input.scene.segment_id, out: input.out_path }, "segment rendered");
  return { segment_id: input.scene.segment_id, composed_mp4_path: input.out_path, duration_ms: input.audio_duration_ms };
}
