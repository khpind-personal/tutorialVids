import { useCurrentFrame, useVideoConfig } from "remotion";
import type { TimelineKeyframe } from "../types.js";

interface Props { keyframes: TimelineKeyframe[]; }

export function Callout({ keyframes }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const calloutKfs = keyframes.filter((k) => k.callout);
  let active: TimelineKeyframe["callout"] | undefined;
  for (const k of calloutKfs) {
    if (k.t_ms <= t_ms && k.callout) {
      active = k.callout.visible ? k.callout : undefined;
    }
  }
  if (!active) return null;
  const anchorStyle =
    active.anchor === "right" ? { right: 80, top: "40%" } :
    active.anchor === "left" ? { left: 80, top: "40%" } :
    active.anchor === "top" ? { top: 80, left: "40%" } :
    { bottom: 80, left: "40%" };
  return (
    <div style={{
      position: "absolute", ...anchorStyle,
      background: "rgba(31,41,55,0.95)", color: "white",
      padding: "12px 18px", borderRadius: 8, maxWidth: 320, fontSize: 22, fontFamily: "system-ui"
    }}>{active.text}</div>
  );
}
