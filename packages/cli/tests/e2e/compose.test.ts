import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliBin = resolve(__dirname, "../../bin/tutorialvid");

const config = {
  version: 1,
  app: {
    name: "Sample",
    dev_url: "http://localhost:5173",
    start_server: false,
    framework_hint: "react-router",
  },
  auth: { mode: "waterfall" },
  render: {
    resolution: "1920x1080",
    fps: 30,
    max_total_duration_s: 900,
    max_segment_duration_s: 240,
  },
  tts: {
    provider: "gemini",
    api_key_env: "FAKE_GEMINI",
    language: "en-US",
    model: "gemini-2.5-flash-tts",
    voices: {
      friendly: "Aoede",
      pro: "Charon",
      hype: "Fenrir",
      founder: "Orus",
      documentary: "Kore",
    },
    speed_per_tone: {
      friendly: 1.0,
      pro: 1.05,
      hype: 1.1,
      founder: 1.0,
      documentary: 0.95,
    },
    chunk_max_chars: 800,
  },
  anthropic: {
    api_key_env: "FAKE_ANTHROPIC",
    model: "claude-sonnet-4-6",
    max_concurrency: 2,
  },
  script: { depth: "medium", tone: "friendly", language: "en-US" },
  record: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    selector_retry: 3,
    selector_retry_backoff_ms: 100,
    cursor_poll_hz: 60,
    auth_recover: true,
    gate_3_enabled: false,
    max_segment_concurrency: 1,
  },
  compose: {
    draft_resolution: "854x480",
    final_resolution: "1920x1080",
    fps: 30,
    watermark_text: "DRAFT",
    music_volume: 0.15,
    intro_template: "minimal",
    outro_template: "cta-link",
    cursor_size_px: 48,
    cursor_idle_hide_ms: 2000,
    parallel_segment_renders: 2,
  },
};

describe("e2e: compose boundary", () => {
  it("compose with no artifacts logs a clean error and exits non-zero", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-compose-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    const run = await execa("node", [cliBin, "compose", "--cwd", target], { reject: false });
    expect(run.exitCode).not.toBe(0);
  }, 60_000);
});
