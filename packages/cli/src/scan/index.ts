import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { detectFramework } from "./framework.js";
import { parseRoutes } from "./routes/index.js";
import { crawl, type CrawlAuth } from "./crawl.js";
import { readGraph } from "./graph.js";
import { reconcile } from "./reconcile.js";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { ScanResult } from "./types.js";
import { logger } from "../logger.js";

async function resolveAuth(config: Config): Promise<CrawlAuth | undefined> {
  const c = config.auth.credentials;
  if (!c) return undefined;
  const username = process.env[c.username_env];
  const password = process.env[c.password_env];
  if (!username || !password) {
    logger.warn(
      { username_env: c.username_env, password_env: c.password_env },
      "credentials env vars not set; crawling without auth"
    );
    return undefined;
  }
  return {
    loginUrl: c.login_url,
    usernameSelector: c.username_selector,
    passwordSelector: c.password_selector,
    submitSelector: c.submit_selector,
    username,
    password
  };
}

async function computeScanHash(projectRoot: string, config: Config): Promise<string> {
  let gitSha = "no-git";
  try {
    const { stdout } = await execa("git", ["rev-parse", "HEAD"], { cwd: projectRoot });
    gitSha = stdout.trim();
  } catch {}
  let lockSha = "no-lock";
  for (const lockName of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
    try {
      const buf = await readFile(join(projectRoot, lockName));
      lockSha = createHash("sha256").update(buf).digest("hex").slice(0, 16);
      break;
    } catch {}
  }
  return hashInputs({ gitSha, lockSha, dev_url: config.app.dev_url });
}

export async function runScan(projectRoot: string, config: Config): Promise<{ result: ScanResult; hash: string }> {
  const framework = await detectFramework(projectRoot, config.app.framework_hint);
  logger.info({ framework }, "framework detected");
  const [routes, graph] = await Promise.all([parseRoutes(framework, projectRoot), readGraph(projectRoot)]);
  let crawlResult;
  try {
    const auth = await resolveAuth(config);
    crawlResult = await crawl({ baseUrl: config.app.dev_url, maxDepth: 3, ...(auth ? { auth } : {}) });
  } catch (err) {
    logger.warn({ err }, "crawl failed; proceeding with empty crawl");
    crawlResult = { pages: [], warnings: [{ code: "crawl-failed", message: (err as Error).message }] };
  }
  const result = reconcile({ framework, baseUrl: config.app.dev_url, routes, crawl: crawlResult, graph });
  const hash = await computeScanHash(projectRoot, config);
  return { result, hash };
}
