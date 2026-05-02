import { Composition, registerRoot } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { SegmentComposition, type SegmentCompositionProps } from "./compose/components/SegmentComposition.js";
import type { ComponentType } from "react";

const DEFAULT_PROPS: SegmentCompositionProps = {
  rawClipPath: "",
  audioPaths: [],
  cursorTrack: { events: [] },
  cursorSvgPath: "",
  cursorSize: 48,
  cursorIdleHideMs: 2000,
  keyframes: [],
  captionWords: [],
  durationMs: 1000
};

// SegmentCompositionProps satisfies Record<string, unknown> at a value level;
// the double assertion is needed because TS's generic constraint is invariant.
type AnyProps = Record<string, unknown>;
const Component = SegmentComposition as unknown as ComponentType<AnyProps>;
const calcMeta: CalculateMetadataFunction<AnyProps> = ({ props }) => {
  const durationMs = (props["durationMs"] as number) ?? 1000;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  return { durationInFrames };
};

const Root: React.FC = () => (
  <Composition
    id="Segment"
    component={Component}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={300}
    defaultProps={DEFAULT_PROPS as unknown as AnyProps}
    calculateMetadata={calcMeta}
  />
);

registerRoot(Root);
