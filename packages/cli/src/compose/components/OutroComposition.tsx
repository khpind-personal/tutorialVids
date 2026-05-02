import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface OutroProps {
  title: string;
  cta: string;
  background: string;
  titleColor: string;
  ctaColor: string;
  titleFontSize: number;
  ctaFontSize: number;
}

export function OutroComposition(props: OutroProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.3, durationInFrames - fps * 0.3, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: props.background, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 32, opacity: fade }}>
      <div style={{ color: props.titleColor, fontSize: props.titleFontSize, fontFamily: "system-ui" }}>{props.title}</div>
      <div style={{ color: props.ctaColor, fontSize: props.ctaFontSize, fontFamily: "system-ui", fontWeight: 700 }}>{props.cta}</div>
    </AbsoluteFill>
  );
}
