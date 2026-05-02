import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface IntroProps {
  title: string;
  background: string;
  titleColor: string;
  fontSize: number;
}

export function IntroComposition(props: IntroProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.3, durationInFrames - fps * 0.3, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, fps * 0.5], [0.9, 1.0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: props.background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: fade, transform: `scale(${scale})`, color: props.titleColor, fontSize: props.fontSize, fontFamily: "system-ui", fontWeight: 700 }}>
        {props.title}
      </div>
    </AbsoluteFill>
  );
}
