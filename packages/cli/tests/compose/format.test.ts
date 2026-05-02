import { describe, it, expect } from "vitest";
import { formatComposeMarkdown } from "../../src/compose/format.js";

describe("formatComposeMarkdown", () => {
  it("renders draft summary with segments + total", () => {
    const md = formatComposeMarkdown({
      draft_path: "/cache/final/draft.mp4",
      segments: [
        { id: "s01_x", mp4: "/cache/compose/s01_x/abc.mp4", duration_ms: 30000 },
        { id: "s02_y", mp4: "/cache/compose/s02_y/def.mp4", duration_ms: 22000 }
      ],
      total_duration_ms: 52000
    });
    expect(md).toMatch(/draft\.mp4/);
    expect(md).toMatch(/0:52/);
    expect(md).toMatch(/s01_x/);
  });
});
