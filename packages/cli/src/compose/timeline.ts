import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";
import type { TimelineKeyframe } from "./types.js";

export interface BuildTimelineInput {
  scene: SceneJson;
  cursor: CursorTrack;
  audio_duration_ms: number;
}

export interface Timeline {
  duration_ms: number;
  keyframes: TimelineKeyframe[];
}

export function buildTimeline(input: BuildTimelineInput): Timeline {
  const kfs: TimelineKeyframe[] = [];
  for (const a of input.scene.actions) {
    if (a.zoom) {
      const start = a.t_ms;
      const peakStart = start + a.zoom.in_ms;
      const peakEnd = peakStart + a.zoom.hold_ms;
      const end = peakEnd + a.zoom.out_ms;
      kfs.push({ t_ms: start, zoom: { scale: 1.0, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: peakStart, zoom: { scale: a.zoom.scale, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: peakEnd, zoom: { scale: a.zoom.scale, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: end, zoom: { scale: 1.0, x_pct: 50, y_pct: 50 } });
    }
    if (a.ripple && a.type === "click") {
      kfs.push({ t_ms: a.t_ms, ripple: { x_pct: 50, y_pct: 50 } });
    }
    if (a.callout) {
      kfs.push({ t_ms: a.t_ms, callout: { text: a.callout.text, anchor: a.callout.anchor, visible: true } });
      kfs.push({ t_ms: a.t_ms + a.callout.duration_ms, callout: { text: a.callout.text, anchor: a.callout.anchor, visible: false } });
    }
  }
  kfs.sort((a, b) => a.t_ms - b.t_ms);
  return { duration_ms: input.audio_duration_ms, keyframes: kfs };
}
