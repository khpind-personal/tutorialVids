import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

let server: ResultPromise | undefined;
const fixtureRoot = resolve(__dirname, "../../../../fixtures/sample-app");
const cliBin = resolve(__dirname, "../../bin/tutorialvid");

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: {
    mode: "waterfall",
    credentials: {
      username_env: "TV_USER", password_env: "TV_PASS",
      username_selector: "[data-test=username]", password_selector: "[data-test=password]",
      submit_selector: "[data-test=submit]", login_url: "/login"
    }
  },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "FAKE_GEMINI_KEY", language: "en-US",
    model: "gemini-2.5-flash-tts",
    voices: { friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" },
    speed_per_tone: { friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 },
    chunk_max_chars: 800
  },
  anthropic: { api_key_env: "FAKE_ANTHROPIC_KEY", model: "claude-sonnet-4-6", max_concurrency: 2 },
  script: { depth: "medium", tone: "friendly", language: "en-US" },
  record: {
    headless: true, viewport: { width: 1920, height: 1080 },
    selector_retry: 3, selector_retry_backoff_ms: 100,
    cursor_poll_hz: 60, auth_recover: true,
    gate_3_enabled: false, max_segment_concurrency: 1
  }
};

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
  server.catch(() => {});
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("dev server did not start");
}, 60_000);
afterAll(() => server?.kill("SIGTERM"));

describe("e2e: tts + record", () => {
  it("scan → plan → tts (no key) exits cleanly with clear error", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-tts-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    const scanRun = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }, reject: false
    });
    expect(scanRun.exitCode, scanRun.stderr).toBe(0);

    const planRun = await execa("node", [cliBin, "plan", "--cwd", target, "--top-n", "1"], { reject: false });
    expect(planRun.exitCode, planRun.stderr).toBe(0);

    // synthesise script artefacts manually (skip Anthropic — no key)
    const scriptDir = join(target, ".tutorialvid/cache/script/s01_dashboard");
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(scriptDir, "fakehash.scene.json"), JSON.stringify({
      segment_id: "s01_dashboard", page_id: "dashboard",
      role: "common", is_common: true,
      depth: "medium", tone: "friendly", target_duration_s: 75,
      actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }],
      narration: { text: "Hello.", ssml: "<speak>Hello.</speak>", alignments: [] }
    }));

    const ttsRun = await execa("node", [cliBin, "tts", "--cwd", target], {
      env: { ...process.env, FAKE_GEMINI_KEY: "" }, reject: false
    });
    expect(ttsRun.exitCode).not.toBe(0);
    expect(ttsRun.stderr + ttsRun.stdout).toMatch(/FAKE_GEMINI_KEY|api.*key/i);
  }, 120_000);
});
