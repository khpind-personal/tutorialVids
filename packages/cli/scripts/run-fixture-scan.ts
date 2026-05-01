import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { setTimeout as wait } from "node:timers/promises";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, "../../../fixtures/sample-app");
const cliBin = resolve(here, "../bin/tutorialvid");

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

const tmp = mkdtempSync(join(tmpdir(), "tv-scan-fixture-"));
mkdirSync(join(tmp, ".tutorialvid"));
writeFileSync(join(tmp, ".tutorialvid", "config.json"), JSON.stringify(config, null, 2));
writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
mkdirSync(join(tmp, "src"));
writeFileSync(join(tmp, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

console.log(`fixture scan working dir: ${tmp}`);

const server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
server.catch(() => {});
try {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) break; } catch {}
    await wait(500);
  }
  await execa("node", [cliBin, "scan", "--cwd", tmp], {
    stdio: "inherit",
    env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }
  });
  console.log(`scan complete: ls ${join(tmp, ".tutorialvid/cache/scan")}`);
} finally {
  server.kill("SIGTERM");
}
