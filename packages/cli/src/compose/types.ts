import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";

export interface TimelineKeyframe {
  t_ms: number;
  zoom?: { scale: number; x_pct: number; y_pct: number };
  callout?: { text: string; anchor: "left" | "right" | "top" | "bottom"; visible: boolean };
  ripple?: { x_pct: number; y_pct: number };
}

export interface SegmentTimeline {
  segment_id: string;
  duration_ms: number;
  keyframes: TimelineKeyframe[];
  cursor: CursorTrack;
  caption_words: { word: string; start_ms: number; end_ms: number }[];
  audio_paths: string[];
  raw_clip_path: string;
  zoom_default_centre: { x_pct: number; y_pct: number };
}

export interface ComposeInput {
  scene: SceneJson;
  cursor: CursorTrack;
  audio_paths: string[];
  audio_duration_ms: number;
  caption_words: { word: string; start_ms: number; end_ms: number }[];
  raw_clip_path: string;
  out_path: string;
  resolution: { width: number; height: number };
  fps: number;
  cursor_svg_path: string;
  cursor_size_px: number;
  cursor_idle_hide_ms: number;
}

export interface ComposeResult {
  segment_id: string;
  composed_mp4_path: string;
  duration_ms: number;
}
