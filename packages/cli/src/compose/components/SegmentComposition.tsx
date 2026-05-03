import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { ZoomLayer } from "./ZoomLayer.js";
import { CursorOverlay } from "./CursorOverlay.js";
import { Callout } from "./Callout.js";
import { CaptionBar } from "./CaptionBar.js";
import { Spotlight } from "./Spotlight.js";
import { HighlightFrame } from "./HighlightFrame.js";
import type { TimelineKeyframe } from "../types.js";
import type { CursorTrack } from "../../record/types.js";
import type { SrtWord } from "../srt.js";

export interface SegmentCompositionProps {
  rawClipPath: string;
  audioPaths: string[];
  audioOffsetsMs?: number[];
  cursorTrack: CursorTrack;
  cursorSvgPath: string;
  cursorSize: number;
  cursorIdleHideMs: number;
  keyframes: TimelineKeyframe[];
  captionWords: SrtWord[];
  durationMs: number;
}

export function SegmentComposition(props: SegmentCompositionProps) {
  const { fps } = useVideoConfig();
  const offsets = props.audioOffsetsMs ?? props.audioPaths.map(() => 0);
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <ZoomLayer keyframes={props.keyframes}>
        <OffthreadVideo src={props.rawClipPath} muted />
      </ZoomLayer>
      {/* Spotlight + HighlightFrame render in screen-space (apply zoom transform manually)
          so the focal box stays pixel-perfect to the on-screen element regardless of zoom. */}
      <Spotlight keyframes={props.keyframes} viewport={{ width: 1920, height: 1080 }} />
      <HighlightFrame keyframes={props.keyframes} viewport={{ width: 1920, height: 1080 }} />
      <CursorOverlay
        track={props.cursorTrack}
        svgPath={props.cursorSvgPath}
        sizePx={props.cursorSize}
        idleHideMs={props.cursorIdleHideMs}
        totalDurationMs={props.durationMs}
      />
      <Callout keyframes={props.keyframes} />
      <CaptionBar words={props.captionWords} />
      {props.audioPaths.map((p, i) => {
        const fromFrames = Math.max(0, Math.round((offsets[i] ?? 0) / 1000 * fps));
        return (
          <Sequence key={i} from={fromFrames}>
            <Audio src={p} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
