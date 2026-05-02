import { describe, it, expect } from "vitest";
import { buildTimeline } from "../../src/compose/timeline.js";
import type { SceneJson } from "../../src/script/types.js";
import type { CursorTrack } from "../../src/record/types.js";

const scene: SceneJson = {
  segment_id: "s01_x", page_id: "x", role: "common", is_common: true,
  depth: "medium", tone: "friendly", target_duration_s: 10,
  actions: [
    { t_ms: 0, type: "nav", url: "/x" },
    { t_ms: 1000, type: "click", selector: "[data-test=btn]",
      zoom: { scale: 2.0, in_ms: 200, hold_ms: 600, out_ms: 200 },
      ripple: true,
      callout: { text: "click here", anchor: "right", duration_ms: 1500 } }
  ],
  narration: { text: "x", ssml: "<speak>x</speak>", alignments: [] }
};

const cursor: CursorTrack = { events: [{ t_ms: 0, x: 100, y: 200, event: "move" }] };

describe("buildTimeline", () => {
  it("emits zoom keyframes around click events", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const zoomKfs = t.keyframes.filter(k => k.zoom);
    expect(zoomKfs.length).toBeGreaterThanOrEqual(2);
    const peak = zoomKfs.find(k => k.zoom?.scale === 2.0);
    expect(peak).toBeDefined();
  });

  it("emits a callout keyframe block matching the click action", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const callouts = t.keyframes.filter(k => k.callout);
    expect(callouts.length).toBeGreaterThanOrEqual(2);
    expect(callouts.find(k => k.callout?.text === "click here" && k.callout.visible)).toBeDefined();
  });

  it("emits a ripple keyframe at click t_ms", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const ripples = t.keyframes.filter(k => k.ripple);
    expect(ripples.length).toBe(1);
    expect(ripples[0]?.t_ms).toBe(1000);
  });

  it("uses audio_duration_ms as the timeline duration", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 7777 });
    expect(t.duration_ms).toBe(7777);
  });

  it("sorts keyframes by t_ms", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    for (let i = 1; i < t.keyframes.length; i++) {
      expect(t.keyframes[i]!.t_ms).toBeGreaterThanOrEqual(t.keyframes[i - 1]!.t_ms);
    }
  });
});
