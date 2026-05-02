import { describe, it, expect } from "vitest";
import { formatScriptMarkdown } from "../../src/script/format.js";
import type { SceneJson } from "../../src/script/types.js";

const scenes: SceneJson[] = [{
  segment_id: "s01_dashboard", page_id: "dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75,
  actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }],
  narration: { text: "Welcome to your dashboard.", ssml: "<speak>Welcome to your dashboard.</speak>", alignments: [] }
}];

describe("formatScriptMarkdown", () => {
  it("renders one section per segment with narration text", () => {
    const md = formatScriptMarkdown(scenes);
    expect(md).toMatch(/## s01_dashboard/);
    expect(md).toMatch(/Welcome to your dashboard/);
    expect(md).toMatch(/medium/);
  });
});
