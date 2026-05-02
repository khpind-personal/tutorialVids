import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorkFile, readWorkFile, writeResultFile, readResultFile, validateNarrationResult, validateSceneResult } from "../../src/script/work-io.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-work-")); });

const work = {
  segment_id: "s01",
  agent_name: "tutorialvid-script-writer",
  system_prompt: "you are sw",
  user_payload: { foo: 1 }
};

describe("work-io", () => {
  it("writes + reads a work file", async () => {
    const path = await writeWorkFile(root, "s01", "writer", work);
    expect(path).toMatch(/_work\/s01\.writer\.json$/);
    const back = await readWorkFile(path);
    expect(back.segment_id).toBe("s01");
  });

  it("writes + reads a result file", async () => {
    const path = await writeResultFile(root, "s01", "writer", { text: "x", ssml: "<speak>x</speak>", alignments: [] });
    expect(path).toMatch(/_result\/s01\.writer\.json$/);
    const back = await readResultFile<{ text: string }>(path);
    expect(back.text).toBe("x");
  });

  it("validateNarrationResult passes valid shape", () => {
    expect(validateNarrationResult({ text: "x", ssml: "<speak>x</speak>", alignments: [] })).toBe(true);
  });

  it("validateNarrationResult rejects missing fields", () => {
    expect(validateNarrationResult({ text: "x" })).toBe(false);
  });

  it("validateSceneResult passes valid shape", () => {
    expect(validateSceneResult({ actions: [{ t_ms: 0, type: "nav", url: "/x" }] })).toBe(true);
  });

  it("validateSceneResult rejects empty actions", () => {
    expect(validateSceneResult({ actions: [] })).toBe(false);
  });
});
