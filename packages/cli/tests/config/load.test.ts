import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/load.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tv-cfg-"));
  mkdirSync(join(root, ".tutorialvid"));
});

const valid = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false },
  auth: { mode: "waterfall" },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" }
};

describe("loadConfig", () => {
  it("loads + validates a valid config", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.app.name).toBe("Sample");
    expect(cfg.render.fps).toBe(30);
  });
  it("rejects missing file with clear error", async () => {
    await expect(loadConfig(root)).rejects.toThrow(/config not found/i);
  });
  it("rejects invalid schema", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify({ version: 1 }));
    await expect(loadConfig(root)).rejects.toThrow(/invalid config/i);
  });
  it("applies sensible defaults for optional fields", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.telemetry?.enabled).toBe(false);
  });
  it("applies defaults for new anthropic + script blocks", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.anthropic.model).toBe("claude-sonnet-4-6");
    expect(cfg.anthropic.max_concurrency).toBe(4);
    expect(cfg.script.depth).toBe("medium");
    expect(cfg.script.tone).toBe("friendly");
  });
  it("provides default voice + speed mapping per tone and record defaults", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.tts.voices.friendly).toBe("Aoede");
    expect(cfg.tts.speed_per_tone.documentary).toBe(0.95);
    expect(cfg.tts.chunk_max_chars).toBe(800);
    expect(cfg.record.headless).toBe(true);
    expect(cfg.record.viewport.width).toBe(1920);
  });
  it("provides compose defaults", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.compose.draft_resolution).toBe("1920x1080");
    expect(cfg.compose.fps).toBe(30);
    expect(cfg.compose.music_volume).toBe(0.15);
    expect(cfg.compose.cursor_size_px).toBe(48);
  });
});
