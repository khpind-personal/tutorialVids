import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "../../src/llm/anthropic.js";
import type { AgentPrompt } from "../../src/llm/types.js";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  }
}));

beforeEach(() => {
  mockCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

const agent: AgentPrompt = {
  name: "test-agent",
  description: "test",
  system: "You are a test agent."
};

describe("dispatch", () => {
  it("calls Anthropic with cached system prompt + returns parsed result", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 100 },
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn"
    });
    const r = await dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6" });
    expect(r.text).toBe("ok");
    expect(r.inputTokens).toBe(100);
    expect(r.cacheCreationTokens).toBe(100);
    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.system).toEqual([
      { type: "text", text: "You are a test agent.", cache_control: { type: "ephemeral" } }
    ]);
  });

  it("throws when API key env var is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6" }))
      .rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it("retries on 529/overloaded with exponential backoff", async () => {
    const overloaded = Object.assign(new Error("overloaded"), { status: 529 });
    mockCreate
      .mockRejectedValueOnce(overloaded)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "after retry" }],
        usage: { input_tokens: 10, output_tokens: 2 },
        model: "claude-sonnet-4-6",
        stop_reason: "end_turn"
      });
    const r = await dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6", retryDelayMs: 1 });
    expect(r.text).toBe("after retry");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
