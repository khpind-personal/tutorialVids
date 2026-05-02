import { interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "./types.js";

const EASE = Easing.bezier(0.33, 0, 0.45, 1);

export interface ZoomState {
  scale: number;
  x_pct: number;
  y_pct: number;
}

export function getCurrentZoom(keyframes: TimelineKeyframe[], t_ms: number): ZoomState {
  const zoomKfs = keyframes.filter((k) => k.zoom);
  if (zoomKfs.length === 0) return { scale: 1, x_pct: 50, y_pct: 50 };
  const seen = new Set<number>();
  const filtered = zoomKfs.filter((k) => { if (seen.has(k.t_ms)) return false; seen.add(k.t_ms); return true; });
  if (filtered.length === 0) return { scale: 1, x_pct: 50, y_pct: 50 };
  const input = filtered.map((k) => k.t_ms);
  const opts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE };
  return {
    scale: interpolate(t_ms, input, filtered.map((k) => k.zoom!.scale), opts),
    x_pct: interpolate(t_ms, input, filtered.map((k) => k.zoom!.x_pct), opts),
    y_pct: interpolate(t_ms, input, filtered.map((k) => k.zoom!.y_pct), opts)
  };
}

export interface Bbox { x: number; y: number; w: number; h: number; }

// Apply the same CSS transform-origin scale that ZoomLayer applies to the video,
// so that a raw bbox in source-page coords lands exactly on the visible element.
export function transformBboxToScreen(raw: Bbox, zoom: ZoomState, viewport: { width: number; height: number }): Bbox {
  const ox = (viewport.width * zoom.x_pct) / 100;
  const oy = (viewport.height * zoom.y_pct) / 100;
  return {
    x: ox + (raw.x - ox) * zoom.scale,
    y: oy + (raw.y - oy) * zoom.scale,
    w: raw.w * zoom.scale,
    h: raw.h * zoom.scale
  };
}
