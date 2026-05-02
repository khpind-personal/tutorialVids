import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runPlan } from "../plan/index.js";
import { formatPlanMarkdown } from "../plan/format.js";
import { logger } from "../logger.js";
import type { ScanResult } from "../scan/types.js";

export interface PlanCommandOpts {
  cwd: string;
  selected?: string[];
  topN?: number;
  printMarkdown?: boolean;
}

async function readLatestScan(scanDir: string): Promise<ScanResult> {
  const entries = await readdir(scanDir);
  if (entries.length === 0) throw new Error("no scan.json found in cache; run 'tutorialvid scan' first");
  const target = join(scanDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as ScanResult;
}

export async function planCommand(opts: PlanCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try { config = await loadConfig(projectRoot); }
  catch (err) {
    logger.error({ err: (err as Error).message }, "config load failed");
    return 1;
  }
  const paths = cachePaths(projectRoot);
  const store = new CacheStore(paths);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("plan");

  try {
    const scan = await readLatestScan(join(paths.cache, "scan"));
    const { plan, hash } = await runPlan({
      scan, config,
      selectedPageIds: opts.selected ?? [],
      ...(opts.topN !== undefined ? { defaultTopN: opts.topN } : {})
    });

    const target = paths.plan(hash);
    const existing = await store.readJson(target);
    if (existing) {
      logger.info({ target }, "plan cache hit");
    } else {
      await store.writeJson(target, plan);
      logger.info({ target, segments: plan.segments.length }, "plan written");
    }
    await sm.markStageComplete("plan");

    if (opts.printMarkdown !== false) {
      process.stdout.write(formatPlanMarkdown(plan) + "\n");
    }
    return 0;
  } catch (err) {
    const { formatError, renderError } = await import("../ux/error.js");
    process.stderr.write(renderError(formatError(err, "plan")));
    return 1;
  }
}
