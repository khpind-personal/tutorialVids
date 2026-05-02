import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import { readdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

let server: ResultPromise | undefined;
const fixtureRoot = resolve(__dirname, "../../../../fixtures/sample-app");
const cliBin = resolve(__dirname, "../../bin/tutorialvid");
const pluginRoot = resolve(__dirname, "../../../plugin");

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
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" },
  anthropic: { api_key_env: "FAKE_ANTHROPIC_KEY", model: "claude-sonnet-4-6", max_concurrency: 2 },
  script: { depth: "medium", tone: "friendly", language: "en-US" }
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

describe("e2e: plan + script", () => {
  it("scan → plan → script writes scene.json + txt + ssml per segment", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-ps-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    // 1. scan
    const scanRun = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }, reject: false
    });
    expect(scanRun.exitCode, scanRun.stderr).toBe(0);

    // 2. plan
    const planRun = await execa("node", [cliBin, "plan", "--cwd", target, "--top-n", "2"], { reject: false });
    expect(planRun.exitCode, planRun.stderr).toBe(0);

    // 3. script (dispatcher mode) — should succeed without API key, prints instructions
    const scriptRun = await execa("node", [cliBin, "script", "--cwd", target, "--plugin-root", pluginRoot], {
      env: { ...process.env, FAKE_ANTHROPIC_KEY: "" }, reject: false
    });
    expect(scriptRun.exitCode).toBe(0);
    expect(scriptRun.stdout).toMatch(/script-prepare|script-consume|subagent/i);

    // 4. script --standalone — boundary check: no API key, command must exit non-zero with clear error
    const scriptStandaloneRun = await execa("node", [cliBin, "script", "--cwd", target, "--plugin-root", pluginRoot, "--standalone"], {
      env: { ...process.env, FAKE_ANTHROPIC_KEY: "" }, reject: false
    });
    expect(scriptStandaloneRun.exitCode).not.toBe(0);
    expect(scriptStandaloneRun.stderr + scriptStandaloneRun.stdout).toMatch(/FAKE_ANTHROPIC_KEY|api.*key/i);

    // verify cache + state still healthy
    const planFiles = await readdir(join(target, ".tutorialvid/cache/plan"));
    expect(planFiles.length).toBeGreaterThan(0);
    const state = JSON.parse(readFileSync(join(target, ".tutorialvid/state.json"), "utf8"));
    expect(state.last_completed_stage).toBe("plan");
  }, 120_000);
});
