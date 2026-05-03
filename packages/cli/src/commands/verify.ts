import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { verifyAll } from "../verify/index.js";
import { formatVerifyMarkdown } from "../verify/format.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import type { SceneJson } from "../script/types.js";

export interface VerifyCommandOpts {
  cwd: string;
  printMarkdown?: boolean;
  failOnWarning?: boolean;
}

async function loadAllScenes(scriptDir: string): Promise<SceneJson[]> {
  const segDirs = await readdir(scriptDir);
  const scenes: SceneJson[] = [];
  for (const seg of segDirs) {
    const segPath = join(scriptDir, seg);
    let files: string[];
    try { files = await readdir(segPath); } catch { continue; }
    const sceneFile = files.find((f) => f.endsWith(".scene.json"));
    if (!sceneFile) continue;
    const raw = await readFile(join(segPath, sceneFile), "utf8");
    scenes.push(JSON.parse(raw) as SceneJson);
  }
  return scenes;
}

export async function verifyCommand(opts: VerifyCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try { config = await loadConfig(projectRoot); }
  catch (err) {
    process.stderr.write(renderError(formatError(err, "verify")));
    return 1;
  }

  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("verify");

  let scenes: SceneJson[];
  try { scenes = await loadAllScenes(join(paths.cache, "script")); }
  catch (err) {
    process.stderr.write(renderError(formatError(err, "verify")));
    return 1;
  }

  if (scenes.length === 0) {
    process.stderr.write("✖ verify\n  why: no scenes found in cache; run earlier stages first\n  next: tutorialvid script-prepare && (dispatch) && tutorialvid script-consume\n");
    return 1;
  }

  const results = await verifyAll({
    scenes,
    scriptRoot: join(paths.cache, "script"),
    recordRoot: join(paths.cache, "record"),
    composeRoot: join(paths.cache, "compose")
  });

  const errorCount = results.reduce((acc, r) => acc + r.issues.filter((i) => i.severity === "error").length, 0);
  const warnCount = results.reduce((acc, r) => acc + r.issues.filter((i) => i.severity === "warning").length, 0);

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatVerifyMarkdown(results) + "\n");
  }

  logger.info({ segments: results.length, errors: errorCount, warnings: warnCount }, "verify complete");

  void config;

  if (errorCount > 0) return 1;
  if (opts.failOnWarning && warnCount > 0) return 1;
  return 0;
}
