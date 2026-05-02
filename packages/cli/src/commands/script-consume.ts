import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { consumeSegmentResults } from "../script/consume.js";
import { formatScriptMarkdown } from "../script/format.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import type { Plan } from "../plan/types.js";
import type { SceneJson } from "../script/types.js";

export interface ScriptConsumeCommandOpts { cwd: string; printMarkdown?: boolean; }

async function readLatestPlan(planDir: string): Promise<Plan> {
  const entries = await readdir(planDir);
  const target = join(planDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as Plan;
}

export async function scriptConsumeCommand(opts: ScriptConsumeCommandOpts): Promise<number> {
  let config;
  try { config = await loadConfig(opts.cwd); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-consume"))); return 1; }
  const paths = cachePaths(opts.cwd);
  const sm = new StateMachine(opts.cwd);
  await sm.load();
  await sm.recordCommand("script-consume");

  let plan: Plan;
  try { plan = await readLatestPlan(join(paths.cache, "plan")); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-consume"))); return 1; }

  const scenes: SceneJson[] = [];
  for (const segment of plan.segments) {
    try {
      const r = await consumeSegmentResults({ segment, cacheRoot: paths.cache });
      scenes.push(r.scene);
      await sm.markSegmentStage(segment.id, "script", "ok");
    } catch (err) {
      await sm.markSegmentStage(segment.id, "script", "failed", (err as Error).message);
      process.stderr.write(renderError(formatError(err, "script-consume")));
      return 1;
    }
  }
  await sm.markStageComplete("script");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatScriptMarkdown(scenes) + "\n");
  }
  void config;
  logger.info({ segments: scenes.length }, "script-consume complete");
  return 0;
}
