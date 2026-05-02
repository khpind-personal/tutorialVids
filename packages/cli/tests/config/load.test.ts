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
});
