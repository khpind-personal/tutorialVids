import { runScan } from "../scan/index.js";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { logger } from "../logger.js";

export interface ScanCommandOpts { cwd: string; }

export async function scanCommand(opts: ScanCommandOpts): Promise<number> {
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
  const { result, hash } = await runScan(projectRoot, config);
  const target = paths.scan(hash);
  const existing = await store.readJson(target);
  if (existing) {
    logger.info({ target }, "scan cache hit");
  } else {
    await store.writeJson(target, result);
    logger.info({ target, pages: result.pages.length, warnings: result.warnings.length }, "scan written");
  }
  await sm.markStageComplete("scan");
  return 0;
}
