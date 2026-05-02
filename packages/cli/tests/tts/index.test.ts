import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTts } from "../../src/tts/index.js";

const synthMock = vi.fn();
vi.mock("../../src/tts/gemini.js", () => ({
  synthesiseChunk: (...args: unknown[]) => synthMock(...args)
}));

beforeEach(() => synthMock.mockReset());

describe("runTts", () => {
  it("synthesises one mp3 per chunk and concatenates timing", async () => {
    synthMock.mockResolvedValue({
      mp3_path: "/tmp/0.mp3",
      duration_ms: 1000,
      timing: [{ word: "x", start_ms: 0, end_ms: 1000 }]
    });
    const root = mkdtempSync(join(tmpdir(), "tv-tts-"));
    const r = await runTts({
      ssml: "<speak>One. Two. Three.</speak>",
      tone: "friendly",
      voices: { friendly: "Aoede", pro: "x", hype: "x", founder: "x", documentary: "x" },
      speeds: { friendly: 1.0, pro: 1, hype: 1, founder: 1, documentary: 1 },
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US",
      chunkMaxChars: 5,
      outDir: root
    });
    expect(r.chunks.length).toBeGreaterThanOrEqual(2);
    expect(r.duration_ms).toBeGreaterThan(0);
    expect(r.timing.length).toBeGreaterThan(0);
  });
});
