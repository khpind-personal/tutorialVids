import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { CursorTrack } from "../../record/types.js";

interface Props {
  track: CursorTrack;
  svgPath: string;
  sizePx: number;
  idleHideMs: number;
  totalDurationMs: number;
}

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

function findBracket(track: CursorTrack, t_ms: number) {
  let prev = track.events[0];
  let next = track.events[0];
  for (let i = 0; i < track.events.length; i++) {
    const e = track.events[i]!;
    if (e.t_ms <= t_ms) prev = e;
    if (e.t_ms >= t_ms) { next = e; break; }
    next = e;
  }
  return { prev, next };
}

export function CursorOverlay({ track, svgPath, sizePx, idleHideMs }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  if (track.events.length === 0) return null;
  const { prev, next } = findBracket(track, t_ms);
  if (!prev || !next) return null;

  // Smooth interpolation between adjacent events.
  let x = prev.x;
  let y = prev.y;
  if (next.t_ms > prev.t_ms) {
    x = interpolate(t_ms, [prev.t_ms, next.t_ms], [prev.x, next.x], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
    y = interpolate(t_ms, [prev.t_ms, next.t_ms], [prev.y, next.y], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  }

  const sinceLast = t_ms - prev.t_ms;
  const opacity = sinceLast > idleHideMs ? interpolate(sinceLast, [idleHideMs, idleHideMs + 400], [1, 0], { extrapolateRight: "clamp" }) : 1;

  // Pulsing ripple on click events: scale 0→1 + opacity 0.6→0 over 600ms
  const downEvent = track.events.filter((e) => e.event === "down" && e.t_ms <= t_ms).pop();
  const sinceDown = downEvent ? t_ms - downEvent.t_ms : Infinity;
  const ripple = sinceDown < 600 ? {
    scale: interpolate(sinceDown, [0, 600], [0.3, 2.4], { easing: Easing.out(Easing.cubic) }),
    opacity: interpolate(sinceDown, [0, 600], [0.55, 0], { easing: Easing.out(Easing.quad) }),
    x: downEvent!.x,
    y: downEvent!.y
  } : null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {ripple && (
        <div
          style={{
            position: "absolute",
            left: ripple.x - 36,
            top: ripple.y - 36,
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.95)",
            background: "rgba(255,255,255,0.10)",
            transform: `scale(${ripple.scale})`,
            opacity: ripple.opacity,
            willChange: "transform, opacity"
          }}
        />
      )}
      <img
        src={svgPath}
        alt="cursor"
        style={{
          position: "absolute",
          left: x - sizePx / 2,
          top: y - sizePx / 2,
          width: sizePx,
          height: sizePx,
          opacity,
          willChange: "left, top, opacity",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
        }}
      />
    </AbsoluteFill>
  );
}
