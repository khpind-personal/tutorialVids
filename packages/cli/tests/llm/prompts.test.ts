import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentPrompt } from "../../src/llm/prompts.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tv-prompts-"));
  mkdirSync(join(root, "agents"));
});

describe("loadAgentPrompt", () => {
  it("parses frontmatter + body from an agent .md file", async () => {
    writeFileSync(
      join(root, "agents/tutorialvid-script-writer.md"),
      `---
name: tutorialvid-script-writer
description: per-segment narration writer
model: claude-sonnet-4-6
---
You are a tutorial narration writer. Be concise and warm.`
    );
    const p = await loadAgentPrompt(root, "tutorialvid-script-writer");
    expect(p.name).toBe("tutorialvid-script-writer");
    expect(p.model).toBe("claude-sonnet-4-6");
    expect(p.system).toContain("tutorial narration writer");
  });

  it("throws clear error when agent file missing", async () => {
    await expect(loadAgentPrompt(root, "missing"))
      .rejects.toThrow(/agent prompt not found/i);
  });

  it("throws when frontmatter missing required fields", async () => {
    writeFileSync(join(root, "agents/bad.md"), `---\n---\nbody only`);
    await expect(loadAgentPrompt(root, "bad"))
      .rejects.toThrow(/missing.*(name|description)/i);
  });
});
