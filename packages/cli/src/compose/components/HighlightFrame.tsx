import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "../types.js";
import { getCurrentZoom, transformBboxToScreen } from "../zoom-state.js";

interface Props { keyframes: TimelineKeyframe[]; viewport: { width: number; height: number }; }

const FADE_MS = 320;
const PULSE_PERIOD_MS = 1800;

interface ActiveFrame {
  bbox: { x: number; y: number; w: number; h: number };
  startedAt: number;
  endsAt: number;
  pad: number;
  radius: number;
  pulse: boolean;
}

export function HighlightFrame({ keyframes, viewport }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const hlKfs = keyframes.filter((k) => k.highlight && (k.highlight.style === "glow" || k.highlight.style === "both"));

  let cur: ActiveFrame | null = null;
  for (let i = 0; i < hlKfs.length; i++) {
    const k = hlKfs[i]!;
    if (k.t_ms > t_ms) break;
    if (!k.highlight?.visible) continue;
    let endsAt = Infinity;
    for (let j = i + 1; j < hlKfs.length; j++) {
      const k2 = hlKfs[j]!;
      if (k2.highlight && !k2.highlight.visible) { endsAt = k2.t_ms; break; }
    }
    cur = {
      bbox: k.highlight!.bbox,
      startedAt: k.t_ms,
      endsAt,
      pad: k.highlight!.pad ?? 6,
      radius: k.highlight!.radius ?? 10,
      pulse: k.highlight!.pulse ?? true
    };
  }
  if (!cur) return null;
  if (t_ms > cur.endsAt + FADE_MS) return null;

  const fadeIn = interpolate(t_ms - cur.startedAt, [0, FADE_MS], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const fadeOut = interpolate(cur.endsAt - t_ms, [0, FADE_MS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const opacity = Math.min(fadeIn, fadeOut);

  // Subtle pulse — opacity breath only, no scale travel (was too distracting per user feedback).
  const phase = ((t_ms - cur.startedAt) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
  const pulseAlpha = cur.pulse ? 0.7 + 0.3 * Math.abs(Math.sin(phase * Math.PI)) : 1;

  const zoom = getCurrentZoom(keyframes, t_ms);
  const screen = transformBboxToScreen(cur.bbox, zoom, viewport);
  const padScreen = cur.pad * zoom.scale;
  const radiusScreen = cur.radius * zoom.scale;

  const x = screen.x - padScreen;
  const y = screen.y - padScreen;
  const w = screen.w + padScreen * 2;
  const h = screen.h + padScreen * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radiusScreen,
        border: "2px solid rgba(99, 179, 237, 0.95)",
        // Tight glow — small spread, low alpha. No outer halo at all.
        boxShadow: `0 0 0 1px rgba(99, 179, 237, ${0.55 * pulseAlpha}), 0 0 12px rgba(99, 179, 237, ${0.45 * pulseAlpha})`,
        opacity: opacity * pulseAlpha,
        pointerEvents: "none",
        willChange: "opacity"
      }}
    />
  );
}
