import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runTts } from "../tts/index.js";
import { logger } from "../logger.js";
import type { SceneJson } from "../script/types.js";

export interface TtsCommandOpts { cwd: string; }

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

export async function ttsCommand(opts: TtsCommandOpts): Promise<number> {
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
  await sm.recordCommand("tts");

  let scenes: SceneJson[];
  try { scenes = await loadAllScenes(join(paths.cache, "script")); }
  catch (err) {
    logger.error({ err: (err as Error).message }, "no script artifacts; run 'tutorialvid script' first");
    return 1;
  }

  for (const scene of scenes) {
    try {
      const r = await runTts({
        ssml: scene.narration.ssml,
        tone: scene.tone as "friendly" | "pro" | "hype" | "founder" | "documentary",
        voices: config.tts.voices,
        speeds: config.tts.speed_per_tone,
        apiKeyEnv: config.tts.api_key_env,
        model: config.tts.model,
        language: config.tts.language,
        chunkMaxChars: config.tts.chunk_max_chars,
        outDir: join(paths.cache, "script", scene.segment_id)
      });
      await store.writeJson(paths.script(scene.segment_id, "tts", "timing.json"), { duration_ms: r.duration_ms, timing: r.timing, chunks: r.chunks });
      await sm.markSegmentStage(scene.segment_id, "tts", "ok");
      logger.info({ segment: scene.segment_id, duration_ms: r.duration_ms, chunks: r.chunks.length }, "tts written");
    } catch (err) {
      logger.error({ err: (err as Error).message, segment: scene.segment_id }, "tts segment failed");
      await sm.markSegmentStage(scene.segment_id, "tts", "failed", (err as Error).message);
      return 1;
    }
  }
  await sm.markStageComplete("tts");
  return 0;
}
