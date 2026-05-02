import { AbsoluteFill, Audio, OffthreadVideo } from "remotion";
import { ZoomLayer } from "./ZoomLayer.js";
import { CursorOverlay } from "./CursorOverlay.js";
import { Callout } from "./Callout.js";
import { CaptionBar } from "./CaptionBar.js";
import type { TimelineKeyframe } from "../types.js";
import type { CursorTrack } from "../../record/types.js";
import type { SrtWord } from "../srt.js";

export interface SegmentCompositionProps {
  rawClipPath: string;
  audioPaths: string[];
  cursorTrack: CursorTrack;
  cursorSvgPath: string;
  cursorSize: number;
  cursorIdleHideMs: number;
  keyframes: TimelineKeyframe[];
  captionWords: SrtWord[];
  durationMs: number;
}

export function SegmentComposition(props: SegmentCompositionProps) {
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <ZoomLayer keyframes={props.keyframes}>
        <OffthreadVideo src={props.rawClipPath} muted />
      </ZoomLayer>
      <CursorOverlay
        track={props.cursorTrack}
        svgPath={props.cursorSvgPath}
        sizePx={props.cursorSize}
        idleHideMs={props.cursorIdleHideMs}
        totalDurationMs={props.durationMs}
      />
      <Callout keyframes={props.keyframes} />
      <CaptionBar words={props.captionWords} />
      {props.audioPaths.map((p, i) => <Audio key={i} src={p} />)}
    </AbsoluteFill>
  );
}
