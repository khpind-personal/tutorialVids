import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runScript } from "../script/index.js";
import { formatScriptMarkdown } from "../script/format.js";
import { logger } from "../logger.js";
import type { ScanResult } from "../scan/types.js";
import type { Plan } from "../plan/types.js";

export interface ScriptCommandOpts {
  cwd: string;
  pluginRoot?: string;
  printMarkdown?: boolean;
}

async function readLatestJson<T>(dir: string): Promise<T> {
  const entries = await readdir(dir);
  if (entries.length === 0) throw new Error(`no artifacts in ${dir}`);
  const target = join(dir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as T;
}

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export async function scriptCommand(opts: ScriptCommandOpts): Promise<number> {
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
  await sm.recordCommand("script");

  let scan: ScanResult;
  let plan: Plan;
  try {
    scan = await readLatestJson<ScanResult>(join(paths.cache, "scan"));
    plan = await readLatestJson<Plan>(join(paths.cache, "plan"));
  } catch (err) {
    logger.error({ err: (err as Error).message }, "missing scan or plan; run 'tutorialvid scan' and 'tutorialvid plan' first");
    return 1;
  }

  const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;

  let artifacts;
  try {
    artifacts = await runScript({ plan, scan, config, pluginRoot });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "script generation failed");
    return 1;
  }

  for (const a of artifacts) {
    const sceneTarget = paths.script(a.scene.segment_id, a.hash, "scene.json");
    await mkdir(dirname(sceneTarget), { recursive: true });
    await store.writeJson(sceneTarget, a.scene);
    const txtTarget = paths.script(a.scene.segment_id, a.hash, "txt");
    await writeFile(txtTarget, a.scene.narration.text, "utf8");
    const ssmlTarget = paths.script(a.scene.segment_id, a.hash, "ssml");
    await writeFile(ssmlTarget, a.scene.narration.ssml, "utf8");
    await sm.markSegmentStage(a.scene.segment_id, "script", "ok");
  }
  await sm.markStageComplete("script");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatScriptMarkdown(artifacts.map((a) => a.scene)) + "\n");
  }
  logger.info({ segments: artifacts.length }, "script written");
  return 0;
}
