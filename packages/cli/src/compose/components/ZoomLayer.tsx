import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { TimelineKeyframe } from "../types.js";
import type { ReactNode } from "react";

interface Props { keyframes: TimelineKeyframe[]; children: ReactNode; }

export function ZoomLayer({ keyframes, children }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const zoomKfs = keyframes.filter((k) => k.zoom);
  if (zoomKfs.length === 0) return <>{children}</>;
  const inputRange = zoomKfs.map((k) => k.t_ms);
  const scaleRange = zoomKfs.map((k) => k.zoom!.scale);
  const xRange = zoomKfs.map((k) => k.zoom!.x_pct);
  const yRange = zoomKfs.map((k) => k.zoom!.y_pct);
  const scale = interpolate(t_ms, inputRange, scaleRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const xPct = interpolate(t_ms, inputRange, xRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const yPct = interpolate(t_ms, inputRange, yRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ width: "100%", height: "100%", transformOrigin: `${xPct}% ${yPct}%`, transform: `scale(${scale})` }}>
      {children}
    </div>
  );
}
