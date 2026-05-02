import { readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { prepareWorkFiles } from "../script/prepare.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import type { ScanResult } from "../scan/types.js";
import type { Plan } from "../plan/types.js";
import type { Discovery } from "../discovery/types.js";

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export interface ScriptPrepareCommandOpts { cwd: string; pluginRoot?: string; }

async function readLatest<T>(dir: string): Promise<T> {
  const entries = await readdir(dir);
  const target = join(dir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as T;
}

async function readLatestOpt<T>(dir: string): Promise<T | undefined> {
  try {
    const entries = await readdir(dir);
    if (entries.length === 0) return undefined;
    const target = join(dir, entries.sort().pop()!);
    return JSON.parse(await readFile(target, "utf8")) as T;
  } catch { return undefined; }
}

export async function scriptPrepareCommand(opts: ScriptPrepareCommandOpts): Promise<number> {
  let config;
  try { config = await loadConfig(opts.cwd); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-prepare"))); return 1; }
  const paths = cachePaths(opts.cwd);
  try {
    const scan = await readLatest<ScanResult>(join(paths.cache, "scan"));
    const plan = await readLatest<Plan>(join(paths.cache, "plan"));
    const discovery = await readLatestOpt<Discovery>(join(paths.cache, "discovery"));
    const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;
    const out = await prepareWorkFiles({
      plan, scan, pluginRoot, cacheRoot: paths.cache,
      ...(discovery ? { discovery } : {})
    });
    for (const wf of out.workFiles) {
      process.stdout.write(`${wf.segment_id}\t${wf.role}\t${wf.path}\n`);
    }
    void config;
    logger.info({ count: out.workFiles.length }, "script-prepare wrote work files");
    return 0;
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "script-prepare")));
    return 1;
  }
}
