import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";
import type { TimelineKeyframe } from "./types.js";

export interface BuildTimelineInput {
  scene: SceneJson;
  cursor: CursorTrack;
  audio_duration_ms: number;
  viewport?: { width: number; height: number };
}

export interface Timeline {
  duration_ms: number;
  keyframes: TimelineKeyframe[];
}

const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

// Smoothing constants — tuned for "professional" feel.
// Cinematic motion: long ease-in, generous hold, gentle ease-out.
const MIN_IN_MS = 700;
const MIN_HOLD_MS = 1800;
const MIN_OUT_MS = 700;
const KEN_BURNS_DRIFT_PCT = 1.5; // small horizontal drift during hold for life
const BLEND_THRESHOLD_MS = 1500; // if next zoom starts within this, don't bounce back to 1.0

function findCursorAt(track: CursorTrack, t_ms: number) {
  let last = track.events[0];
  for (const e of track.events) {
    if (e.t_ms <= t_ms) last = e;
    else break;
  }
  return last;
}

function pxToPct(x: number, y: number, vw: number, vh: number) {
  return { x_pct: Math.max(8, Math.min(92, (x / vw) * 100)), y_pct: Math.max(8, Math.min(92, (y / vh) * 100)) };
}

export function buildTimeline(input: BuildTimelineInput): Timeline {
  const vp = input.viewport ?? DEFAULT_VIEWPORT;
  const kfs: TimelineKeyframe[] = [];
  const zoomActions = input.scene.actions.filter((a) => a.zoom).map((a, i) => ({ a, i }));
  for (let idx = 0; idx < zoomActions.length; idx++) {
    const { a } = zoomActions[idx]!;
    const next = zoomActions[idx + 1]?.a;
    const z = a.zoom!;
    const inMs = Math.max(z.in_ms ?? 0, MIN_IN_MS);
    const holdMs = Math.max(z.hold_ms ?? 0, MIN_HOLD_MS);
    const outMs = Math.max(z.out_ms ?? 0, MIN_OUT_MS);
    const start = a.t_ms;
    const peakStart = start + inMs;
    const peakEnd = peakStart + holdMs;
    const end = peakEnd + outMs;

    // Anchor priority: explicit bbox from director > real cursor coord > centre.
    let anchor: { x_pct: number; y_pct: number };
    const bbox = (z as { bbox?: { x: number; y: number; w: number; h: number } }).bbox;
    if (bbox && bbox.w > 0 && bbox.h > 0) {
      const cx = bbox.x + bbox.w / 2;
      const cy = bbox.y + bbox.h / 2;
      anchor = pxToPct(cx, cy, vp.width, vp.height);
    } else {
      const cur = a.type === "click" ? findCursorAt(input.cursor, a.t_ms) : null;
      anchor = cur && cur.x > 0 && cur.y > 0
        ? pxToPct(cur.x, cur.y, vp.width, vp.height)
        : { x_pct: 50, y_pct: 50 };
    }

    // Ken Burns subtle drift during hold (1.5% horizontal, 0.5% vertical).
    const driftedMid = {
      x_pct: anchor.x_pct + (anchor.x_pct < 50 ? KEN_BURNS_DRIFT_PCT : -KEN_BURNS_DRIFT_PCT),
      y_pct: anchor.y_pct + 0.5
    };

    kfs.push({ t_ms: start, zoom: { scale: 1.0, x_pct: anchor.x_pct, y_pct: anchor.y_pct } });
    kfs.push({ t_ms: peakStart, zoom: { scale: z.scale, x_pct: anchor.x_pct, y_pct: anchor.y_pct } });
    kfs.push({ t_ms: peakEnd, zoom: { scale: z.scale, x_pct: driftedMid.x_pct, y_pct: driftedMid.y_pct } });

    // If next zoom starts within blend threshold, skip the bounce back to 1.0 — pan straight to next anchor.
    const blendToNext = next && (next.t_ms - end) < BLEND_THRESHOLD_MS;
    if (!blendToNext) {
      kfs.push({ t_ms: end, zoom: { scale: 1.0, x_pct: driftedMid.x_pct, y_pct: driftedMid.y_pct } });
    }

    if (a.ripple && a.type === "click") {
      const cur2 = findCursorAt(input.cursor, a.t_ms);
      if (cur2 && cur2.x > 0 && cur2.y > 0) {
        const ripple = pxToPct(cur2.x, cur2.y, vp.width, vp.height);
        kfs.push({ t_ms: a.t_ms, ripple: { x_pct: ripple.x_pct, y_pct: ripple.y_pct } });
      } else {
        kfs.push({ t_ms: a.t_ms, ripple: { x_pct: anchor.x_pct, y_pct: anchor.y_pct } });
      }
    }
  }

  // Highlight actions (spotlight / glow border) — director-specified focus markers.
  // Schema (extension on action): action.highlight = { bbox: {x,y,w,h}, style: "spotlight"|"glow"|"both", duration_ms, intensity?, pad?, radius?, pulse? }
  for (const a of input.scene.actions) {
    const hl = (a as { highlight?: { bbox: { x: number; y: number; w: number; h: number }; style?: "spotlight" | "glow" | "both"; duration_ms?: number; intensity?: number; pad?: number; radius?: number; pulse?: boolean } }).highlight;
    if (hl && hl.bbox) {
      const dur = hl.duration_ms ?? 3000;
      const style = hl.style ?? "both";
      const base = {
        bbox: hl.bbox,
        style,
        ...(hl.intensity !== undefined ? { intensity: hl.intensity } : {}),
        ...(hl.pad !== undefined ? { pad: hl.pad } : {}),
        ...(hl.radius !== undefined ? { radius: hl.radius } : {}),
        ...(hl.pulse !== undefined ? { pulse: hl.pulse } : {})
      };
      kfs.push({ t_ms: a.t_ms, highlight: { ...base, visible: true } });
      kfs.push({ t_ms: a.t_ms + dur, highlight: { ...base, visible: false } });
    }
  }

  // Non-zoom actions: callouts + ripples for clicks without zoom.
  for (const a of input.scene.actions) {
    if (!a.zoom && a.ripple && a.type === "click") {
      const cur = findCursorAt(input.cursor, a.t_ms);
      if (cur) {
        const r = pxToPct(cur.x, cur.y, vp.width, vp.height);
        kfs.push({ t_ms: a.t_ms, ripple: { x_pct: r.x_pct, y_pct: r.y_pct } });
      }
    }
    if (a.callout) {
      const hl = (a as { highlight?: { bbox?: { x: number; y: number; w: number; h: number } } }).highlight;
      const cbbox = hl?.bbox;
      const base = {
        text: a.callout.text,
        anchor: a.callout.anchor,
        ...(a.callout.max_width !== undefined ? { max_width: a.callout.max_width } : {}),
        ...(cbbox ? { bbox: cbbox } : {})
      };
      kfs.push({ t_ms: a.t_ms, callout: { ...base, visible: true } });
      kfs.push({ t_ms: a.t_ms + a.callout.duration_ms, callout: { ...base, visible: false } });
    }
  }

  kfs.sort((a, b) => a.t_ms - b.t_ms);
  return { duration_ms: input.audio_duration_ms, keyframes: kfs };
}
