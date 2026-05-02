import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "../types.js";

interface Props { keyframes: TimelineKeyframe[]; }

type Anchor = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ActiveCallout {
  text: string;
  anchor: Anchor;
  startedAt: number;
  endsAt: number;
  maxWidth: number;
}

const FADE_MS = 280;
const MARGIN = 64;

export function Callout({ keyframes }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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
      maxWidth: k.callout.max_width ?? 360
    };
  }
  if (!cur) return null;
  if (t_ms > cur.endsAt + FADE_MS) return null;

  const sinceStart = t_ms - cur.startedAt;
  const untilEnd = cur.endsAt - t_ms;
  const fadeIn = interpolate(sinceStart, [0, FADE_MS], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const fadeOut = interpolate(untilEnd, [0, FADE_MS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const opacity = Math.min(fadeIn, fadeOut);
  const slide = interpolate(sinceStart, [0, FADE_MS], [10, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const a = cur.anchor;
  const style: Record<string, string | number> = {};
  let translate = "";

  if (a === "top") { style.top = MARGIN; style.left = "50%"; translate = `translate(-50%, ${slide}px)`; }
  else if (a === "bottom") { style.bottom = MARGIN; style.left = "50%"; translate = `translate(-50%, ${-slide}px)`; }
  else if (a === "left") { style.left = MARGIN; style.top = "42%"; translate = `translate(${-slide}px, 0)`; }
  else if (a === "right") { style.right = MARGIN; style.top = "42%"; translate = `translate(${slide}px, 0)`; }
  else if (a === "top-left") { style.top = MARGIN; style.left = MARGIN; translate = `translate(${-slide}px, ${slide}px)`; }
  else if (a === "top-right") { style.top = MARGIN; style.right = MARGIN; translate = `translate(${slide}px, ${slide}px)`; }
  else if (a === "bottom-left") { style.bottom = MARGIN; style.left = MARGIN; translate = `translate(${-slide}px, ${-slide}px)`; }
  else if (a === "bottom-right") { style.bottom = MARGIN; style.right = MARGIN; translate = `translate(${slide}px, ${-slide}px)`; }

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
