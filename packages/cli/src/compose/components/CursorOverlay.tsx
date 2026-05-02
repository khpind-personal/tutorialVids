import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CursorTrack } from "../../record/types.js";

interface Props {
  track: CursorTrack;
  svgPath: string;
  sizePx: number;
  idleHideMs: number;
  totalDurationMs: number;
}

function findCursorAt(track: CursorTrack, t_ms: number): { x: number; y: number; event: string } | null {
  let last: { x: number; y: number; event: string } | null = null;
  for (const e of track.events) {
    if (e.t_ms <= t_ms) last = { x: e.x, y: e.y, event: e.event };
    else break;
  }
  return last;
}

export function CursorOverlay({ track, svgPath, sizePx, idleHideMs }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const pos = findCursorAt(track, t_ms);
  if (!pos) return null;
  const lastEvent = track.events.filter((e) => e.t_ms <= t_ms).pop();
  const sinceLast = lastEvent ? t_ms - lastEvent.t_ms : Infinity;
  const opacity = sinceLast > idleHideMs ? 0 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, transition: "opacity 200ms" }}>
      <img src={svgPath} alt="cursor"
        style={{ position: "absolute", left: pos.x - sizePx / 2, top: pos.y - sizePx / 2, width: sizePx, height: sizePx }} />
      {pos.event === "down" && (
        <div style={{
          position: "absolute", left: pos.x - 24, top: pos.y - 24,
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(255,255,255,0.6)"
        }} />
      )}
    </AbsoluteFill>
  );
}
