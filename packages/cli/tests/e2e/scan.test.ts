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

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: {
    mode: "waterfall",
    credentials: {
      username_env: "TV_USER",
      password_env: "TV_PASS",
      username_selector: "[data-test=username]",
      password_selector: "[data-test=password]",
      submit_selector: "[data-test=submit]",
      login_url: "/login"
    }
  },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" }
};

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
  // Suppress unhandled-rejection when port is already in use (parallel test runs) or on SIGTERM
  server.catch(() => {});
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("sample-app dev server did not start");
}, 60_000);

afterAll(async () => {
  if (server) {
    server.kill("SIGTERM");
    await server.catch(() => {}); // SIGTERM causes exit code 1 — suppress unhandled rejection
  }
});

describe("e2e: tutorialvid scan", () => {
  it("produces a valid scan.json against the fixture sample-app", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-scan-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    const cliBin = resolve(__dirname, "../../bin/tutorialvid");
    const { exitCode, stderr } = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" },
      reject: false
    });
    expect(exitCode, stderr).toBe(0);

    const scanFiles = await readdir(join(target, ".tutorialvid/cache/scan"));
    expect(scanFiles).toHaveLength(1);
    const firstFile = scanFiles[0]!;
    const scan = JSON.parse(readFileSync(join(target, ".tutorialvid/cache/scan", firstFile), "utf8"));
    expect(scan.framework).toBe("react-router");
    expect(scan.pages.map((p: { route: string }) => p.route).sort()).toEqual(
      expect.arrayContaining(["/dashboard", "/login", "/profile"])
    );
  }, 90_000);
});
