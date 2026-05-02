import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { TimelineKeyframe } from "../types.js";
import type { ReactNode } from "react";

interface Props { keyframes: TimelineKeyframe[]; children: ReactNode; }

// Cinematic ease — slow in, slow out. cubic-bezier(0.33, 1, 0.68, 1) = "out cubic"
// for natural deceleration. Pair with bezier(0.32, 0, 0.67, 0) for in.
const EASE = Easing.bezier(0.33, 0, 0.45, 1);

export function ZoomLayer({ keyframes, children }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const zoomKfs = keyframes.filter((k) => k.zoom);
  if (zoomKfs.length === 0) return <>{children}</>;

  // Build monotonic input range — interpolate requires strictly ascending t_ms.
  const seen = new Set<number>();
  const filtered = zoomKfs.filter((k) => {
    if (seen.has(k.t_ms)) return false;
    seen.add(k.t_ms);
    return true;
  });
  const inputRange = filtered.map((k) => k.t_ms);
  const scaleRange = filtered.map((k) => k.zoom!.scale);
  const xRange = filtered.map((k) => k.zoom!.x_pct);
  const yRange = filtered.map((k) => k.zoom!.y_pct);

  const opts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE };
  const scale = interpolate(t_ms, inputRange, scaleRange, opts);
  const xPct = interpolate(t_ms, inputRange, xRange, opts);
  const yPct = interpolate(t_ms, inputRange, yRange, opts);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transformOrigin: `${xPct}% ${yPct}%`,
        transform: `scale(${scale})`,
        willChange: "transform",
        backfaceVisibility: "hidden"
      }}
    >
      {children}
    </div>
  );
}
