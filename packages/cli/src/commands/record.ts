import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { runRecord } from "../record/index.js";
import { formatRecordMarkdown } from "../record/format.js";
import { logger } from "../logger.js";
import type { SceneJson } from "../script/types.js";
import type { ScanResult } from "../scan/types.js";

export interface RecordCommandOpts { cwd: string; printMarkdown?: boolean; }

async function loadAllScenes(scriptDir: string): Promise<SceneJson[]> {
  const segDirs = await readdir(scriptDir);
  const scenes: SceneJson[] = [];
  for (const seg of segDirs) {
    const segPath = join(scriptDir, seg);
    const files = await readdir(segPath);
    const sceneFile = files.find((f) => f.endsWith(".scene.json"));
    if (!sceneFile) continue;
    const raw = await readFile(join(segPath, sceneFile), "utf8");
    scenes.push(JSON.parse(raw) as SceneJson);
  }
  return scenes;
}

async function readLatestScan(scanDir: string): Promise<ScanResult> {
  const entries = await readdir(scanDir);
  const target = join(scanDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as ScanResult;
}

export async function recordCommand(opts: RecordCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try { config = await loadConfig(projectRoot); }
  catch (err) {
    logger.error({ err: (err as Error).message }, "config load failed");
    return 1;
  }
  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("record");

  let scan: ScanResult;
  let scenes: SceneJson[];
  try {
    scan = await readLatestScan(join(paths.cache, "scan"));
    scenes = await loadAllScenes(join(paths.cache, "script"));
  } catch (err) {
    logger.error({ err: (err as Error).message }, "missing scan or script artifacts; run earlier stages first");
    return 1;
  }

  const credentials = config.auth.credentials;

  let results;
  try {
    results = await runRecord({
      scenes, baseUrl: scan.base_url, config,
      outDirRoot: join(paths.cache, "record"),
      ...(credentials ? { authCredentials: credentials } : {}),
      ...(config.auth.storage_state_path ? { storageStatePath: config.auth.storage_state_path } : {})
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "record stage failed");
    return 1;
  }

  for (const r of results) {
    await sm.markSegmentStage(r.segment_id, "record", "ok");
  }
  await sm.markStageComplete("record");

  if (config.record.gate_3_enabled && opts.printMarkdown !== false) {
    process.stdout.write(formatRecordMarkdown(results) + "\n");
  }
  logger.info({ segments: results.length }, "record stage complete");
  return 0;
}
