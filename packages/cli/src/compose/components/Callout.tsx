import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "../types.js";

interface Props { keyframes: TimelineKeyframe[]; }

type Anchor =
  | "auto"
  | "left" | "right" | "top" | "bottom"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ActiveCallout {
  text: string;
  anchor: Anchor;
  startedAt: number;
  endsAt: number;
  maxWidth: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

const FADE_MS = 280;
const MARGIN = 64;
const GAP = 24;

function autoPosition(bbox: { x: number; y: number; w: number; h: number }, vw: number, vh: number, maxWidth: number) {
  const calloutW = maxWidth + 40;
  const calloutH = 96;
  const rightRoom = vw - (bbox.x + bbox.w);
  const leftRoom = bbox.x;
  const bottomRoom = vh - (bbox.y + bbox.h);
  const topRoom = bbox.y;

  if (rightRoom >= calloutW + GAP) {
    const left = bbox.x + bbox.w + GAP;
    const top = Math.max(MARGIN, Math.min(vh - calloutH - MARGIN, bbox.y + bbox.h / 2 - calloutH / 2));
    return { left, top, side: "right" as const };
  }
  if (leftRoom >= calloutW + GAP) {
    const left = bbox.x - calloutW - GAP;
    const top = Math.max(MARGIN, Math.min(vh - calloutH - MARGIN, bbox.y + bbox.h / 2 - calloutH / 2));
    return { left, top, side: "left" as const };
  }
  if (bottomRoom >= calloutH + GAP) {
    const top = bbox.y + bbox.h + GAP;
    const left = Math.max(MARGIN, Math.min(vw - calloutW - MARGIN, bbox.x + bbox.w / 2 - calloutW / 2));
    return { left, top, side: "bottom" as const };
  }
  if (topRoom >= calloutH + GAP) {
    const top = bbox.y - calloutH - GAP;
    const left = Math.max(MARGIN, Math.min(vw - calloutW - MARGIN, bbox.x + bbox.w / 2 - calloutW / 2));
    return { left, top, side: "top" as const };
  }
  return {
    left: Math.max(MARGIN, Math.min(vw - calloutW - MARGIN, bbox.x + bbox.w + GAP)),
    top: MARGIN,
    side: "right" as const
  };
}

export function Callout({ keyframes }: Props) {
  const frame = useCurrentFrame();
  const { fps, width: vw, height: vh } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const calloutKfs = keyframes.filter((k) => k.callout);

  let cur: ActiveCallout | null = null;
  for (let i = 0; i < calloutKfs.length; i++) {
    const k = calloutKfs[i]!;
    if (k.t_ms > t_ms) break;
    if (!k.callout?.visible) continue;
    let endsAt = Infinity;
    for (let j = i + 1; j < calloutKfs.length; j++) {
      const k2 = calloutKfs[j]!;
      if (k2.callout && k2.callout.text === k.callout.text && !k2.callout.visible) {
        endsAt = k2.t_ms;
        break;
      }
    }
    cur = {
      text: k.callout.text,
      anchor: k.callout.anchor as Anchor,
      startedAt: k.t_ms,
      endsAt,
      maxWidth: k.callout.max_width ?? 360,
      ...(k.callout.bbox ? { bbox: k.callout.bbox } : {})
    };
  }
  if (!cur) return null;
  if (t_ms > cur.endsAt + FADE_MS) return null;

  const sinceStart = t_ms - cur.startedAt;
  const untilEnd = cur.endsAt - t_ms;
  const fadeIn = interpolate(sinceStart, [0, FADE_MS], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const fadeOut = interpolate(untilEnd, [0, FADE_MS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const opacity = Math.min(fadeIn, fadeOut);

  const a: Anchor = cur.anchor === "auto" && !cur.bbox ? "top-right" : cur.anchor;
  const style: Record<string, string | number> = {};
  let translate = "";

  if (a === "auto" && cur.bbox) {
    const pos = autoPosition(cur.bbox, vw, vh, cur.maxWidth);
    style.left = pos.left;
    style.top = pos.top;
    const slidePx = 10;
    const dx = pos.side === "right" ? slidePx : pos.side === "left" ? -slidePx : 0;
    const dy = pos.side === "bottom" ? slidePx : pos.side === "top" ? -slidePx : 0;
    const sx = interpolate(sinceStart, [0, FADE_MS], [dx, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const sy = interpolate(sinceStart, [0, FADE_MS], [dy, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    translate = `translate(${sx}px, ${sy}px)`;
  } else {
    const slide = interpolate(sinceStart, [0, FADE_MS], [10, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    if (a === "top") { style.top = MARGIN; style.left = "50%"; translate = `translate(-50%, ${slide}px)`; }
    else if (a === "bottom") { style.bottom = MARGIN; style.left = "50%"; translate = `translate(-50%, ${-slide}px)`; }
    else if (a === "left") { style.left = MARGIN; style.top = "42%"; translate = `translate(${-slide}px, 0)`; }
    else if (a === "right") { style.right = MARGIN; style.top = "42%"; translate = `translate(${slide}px, 0)`; }
    else if (a === "top-left") { style.top = MARGIN; style.left = MARGIN; translate = `translate(${-slide}px, ${slide}px)`; }
    else if (a === "top-right") { style.top = MARGIN; style.right = MARGIN; translate = `translate(${slide}px, ${slide}px)`; }
    else if (a === "bottom-left") { style.bottom = MARGIN; style.left = MARGIN; translate = `translate(${-slide}px, ${-slide}px)`; }
    else if (a === "bottom-right") { style.bottom = MARGIN; style.right = MARGIN; translate = `translate(${slide}px, ${-slide}px)`; }
  }

  if (translate) style.transform = translate;

  return (
    <div
      style={{
        position: "absolute",
        ...style,
        background: "linear-gradient(135deg, rgba(17,24,39,0.96), rgba(31,41,55,0.96))",
        color: "white",
        padding: "14px 20px",
        borderRadius: 12,
        maxWidth: cur.maxWidth,
        fontSize: 22,
        fontWeight: 500,
        lineHeight: 1.32,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui",
        letterSpacing: "-0.01em",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.08)",
        opacity,
        willChange: "opacity, transform"
      }}
    >
      {cur.text}
    </div>
  );
}
