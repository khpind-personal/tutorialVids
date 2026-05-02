import { describe, it, expect, vi, beforeEach } from "vitest";
import { directScene } from "../../src/script/director.js";
import type { Segment } from "../../src/plan/types.js";
import type { ActionHint } from "../../src/scan/types.js";
import type { Narration } from "../../src/script/types.js";

const dispatchMock = vi.fn();
vi.mock("../../src/llm/anthropic.js", () => ({ dispatch: (...args: unknown[]) => dispatchMock(...args) }));

beforeEach(() => dispatchMock.mockReset());

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true
};
const actions: ActionHint[] = [{ selector: "[data-test=link-profile]", label: "Profile", kind: "link" }];
const narration: Narration = {
  text: "Welcome.", ssml: "<speak>Welcome.</speak>",
  alignments: [{ phrase: "Welcome", action_t_ms: 0 }]
};

describe("directScene", () => {
  it("returns a SceneJson with actions array and embedded narration", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: JSON.stringify({
        actions: [
          { t_ms: 0, type: "nav", url: "/dashboard" },
          { t_ms: 2000, type: "click", selector: "[data-test=link-profile]",
            zoom: { scale: 1.8, in_ms: 400, hold_ms: 800, out_ms: 400 }, ripple: true, highlight_score: 7 }
        ]
      }),
      inputTokens: 100, outputTokens: 80, model: "claude-sonnet-4-6", stopReason: "end_turn"
    });
    const agent = { name: "tutorialvid-scene-director", description: "x", system: "you are sd" };
    const r = await directScene({
      agent, segment: seg, page_actions: actions, narration,
      apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6"
    });
    expect(r.scene.segment_id).toBe("s01_dashboard");
    expect(r.scene.actions).toHaveLength(2);
    expect(r.scene.actions[0]?.type).toBe("nav");
    expect(r.scene.narration).toEqual(narration);
  });

  it("rejects when actions is missing or empty", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: '{"actions":[]}', inputTokens: 1, outputTokens: 1, model: "x", stopReason: "end_turn"
    });
    const agent = { name: "x", description: "x", system: "x" };
    await expect(directScene({
      agent, segment: seg, page_actions: actions, narration,
      apiKeyEnv: "K", model: "claude-sonnet-4-6"
    })).rejects.toThrow(/empty|actions/i);
  });
});
