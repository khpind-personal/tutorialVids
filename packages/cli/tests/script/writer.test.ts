import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeNarration } from "../../src/script/writer.js";
import type { Segment } from "../../src/plan/types.js";
import type { ActionHint } from "../../src/scan/types.js";

const dispatchMock = vi.fn();

vi.mock("../../src/llm/anthropic.js", () => ({
  dispatch: (...args: unknown[]) => dispatchMock(...args)
}));

beforeEach(() => dispatchMock.mockReset());

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true,
  role: "common", is_common: true
};
const actions: ActionHint[] = [
  { selector: "[data-test=link-profile]", label: "Profile", kind: "link" }
];

describe("writeNarration", () => {
  it("calls dispatch with the script-writer agent and returns parsed narration", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: '{"text":"Welcome to your Dashboard.","ssml":"<speak>Welcome to your Dashboard.</speak>","alignments":[{"phrase":"Welcome","action_t_ms":0}]}',
      inputTokens: 100, outputTokens: 50, model: "claude-sonnet-4-6", stopReason: "end_turn"
    });
    const agent = { name: "tutorialvid-script-writer", description: "x", system: "you are sw" };
    const r = await writeNarration({
      agent, segment: seg, page_actions: actions, base_url: "http://localhost:5173", language: "en-US",
      apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6"
    });
    expect(r.narration.text).toBe("Welcome to your Dashboard.");
    expect(r.narration.alignments[0]?.phrase).toBe("Welcome");
    expect(dispatchMock).toHaveBeenCalledOnce();
  });

  it("throws when LLM returns invalid JSON", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: "not json", inputTokens: 1, outputTokens: 1, model: "x", stopReason: "end_turn"
    });
    const agent = { name: "x", description: "x", system: "x" };
    await expect(writeNarration({
      agent, segment: seg, page_actions: actions, base_url: "x", language: "en-US",
      apiKeyEnv: "K", model: "claude-sonnet-4-6"
    })).rejects.toThrow(/invalid JSON|narration/i);
  });
});
