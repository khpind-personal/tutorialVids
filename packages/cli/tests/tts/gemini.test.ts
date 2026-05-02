import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synthesiseChunk } from "../../src/tts/gemini.js";

const generateMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generateMock };
  }
}));

vi.mock("../../src/ffprobe.js", () => ({
  probeDurationMs: vi.fn().mockResolvedValue(1500)
}));

beforeEach(() => {
  generateMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("synthesiseChunk", () => {
  it("calls Gemini with voice + speed and writes mp3 to disk", async () => {
    generateMock.mockResolvedValueOnce({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: "audio/mp3",
              data: Buffer.from("fake-mp3-bytes").toString("base64")
            }
          }]
        }
      }]
    });
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    const r = await synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>Hello.</speak>", text: "Hello." },
      voice: "Aoede",
      speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY",
      model: "gemini-2.5-flash-tts",
      language: "en-US",
      outDir
    });
    expect(r.mp3_path).toMatch(/0\.mp3$/);
    expect(r.duration_ms).toBe(1500);
    expect(generateMock).toHaveBeenCalledOnce();
  });

  it("throws when API key env var is unset", async () => {
    delete process.env.GEMINI_API_KEY;
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    await expect(synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>x</speak>", text: "x" },
      voice: "Aoede", speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US", outDir
    })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("throws when response has no audio data", async () => {
    generateMock.mockResolvedValueOnce({ candidates: [{ content: { parts: [] } }] });
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    await expect(synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>x</speak>", text: "x" },
      voice: "Aoede", speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US", outDir
    })).rejects.toThrow(/no audio/i);
  });
});
