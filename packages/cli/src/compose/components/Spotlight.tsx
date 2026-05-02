import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "../types.js";
import { getCurrentZoom, transformBboxToScreen } from "../zoom-state.js";

interface Props { keyframes: TimelineKeyframe[]; viewport: { width: number; height: number }; }

const FADE_MS = 320;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

interface ActiveSpotlight {
  bbox: { x: number; y: number; w: number; h: number };
  startedAt: number;
  endsAt: number;
  intensity: number;
  pad: number;
  radius: number;
}

export function Spotlight({ keyframes, viewport }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const hlKfs = keyframes.filter((k) => k.highlight && k.highlight.style !== "glow");

  let cur: ActiveSpotlight | null = null;
  for (let i = 0; i < hlKfs.length; i++) {
    const k = hlKfs[i]!;
    if (k.t_ms > t_ms) break;
    if (!k.highlight?.visible) continue;
    let endsAt = Infinity;
    for (let j = i + 1; j < hlKfs.length; j++) {
      const k2 = hlKfs[j]!;
      if (k2.highlight && !k2.highlight.visible && samebbox(k2.highlight.bbox, k.highlight!.bbox)) { endsAt = k2.t_ms; break; }
    }
    cur = {
      bbox: k.highlight!.bbox,
      startedAt: k.t_ms,
      endsAt,
      intensity: k.highlight!.intensity ?? 0.55,
      pad: k.highlight!.pad ?? 8,
      radius: k.highlight!.radius ?? 12
    };
  }
  if (!cur) return null;
  if (t_ms > cur.endsAt + FADE_MS) return null;

  const fadeIn = interpolate(t_ms - cur.startedAt, [0, FADE_MS], [0, 1], { extrapolateRight: "clamp", easing: EASE });
  const fadeOut = interpolate(cur.endsAt - t_ms, [0, FADE_MS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const alpha = Math.min(fadeIn, fadeOut) * cur.intensity;

  // Apply the live zoom transform so the spotlight cutout lands exactly on the on-screen element,
  // even when ZoomLayer has scaled/translated the page beneath.
  const zoom = getCurrentZoom(keyframes, t_ms);
  const screen = transformBboxToScreen(cur.bbox, zoom, viewport);

  // Pad scales with zoom — keep visual padding constant in source-px terms.
  const padScreen = cur.pad * zoom.scale;
  const radiusScreen = cur.radius * zoom.scale;

  const x = Math.max(-padScreen, screen.x - padScreen);
  const y = Math.max(-padScreen, screen.y - padScreen);
  const w = Math.max(0, screen.w + padScreen * 2);
  const h = Math.max(0, screen.h + padScreen * 2);

  // Clamp drawing to viewport bounds — mask cutout lives in viewport coordinates regardless.
  const cx = Math.max(0, Math.min(viewport.width, x));
  const cy = Math.max(0, Math.min(viewport.height, y));
  const cw = Math.max(0, Math.min(viewport.width - cx, w - (cx - x)));
  const ch = Math.max(0, Math.min(viewport.height - cy, h - (cy - y)));

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        <mask id="spot-mask">
          <rect width={viewport.width} height={viewport.height} fill="white" />
          <rect x={cx} y={cy} width={cw} height={ch} rx={radiusScreen} ry={radiusScreen} fill="black" />
        </mask>
      </defs>
      <rect width={viewport.width} height={viewport.height} fill="black" opacity={alpha} mask="url(#spot-mask)" />
    </svg>
  );
}

function samebbox(a?: { x: number; y: number; w: number; h: number }, b?: { x: number; y: number; w: number; h: number }) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
