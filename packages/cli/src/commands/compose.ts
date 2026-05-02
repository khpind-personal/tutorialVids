import { readdir, readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { runCompose } from "../compose/index.js";
import { formatComposeMarkdown } from "../compose/format.js";
import { logger } from "../logger.js";
import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export interface ComposeCommandOpts {
  cwd: string;
  pluginRoot?: string;
  printMarkdown?: boolean;
}

interface LiveBboxEntry {
  t_ms: number;
  beat?: string;
  selector: string;
  bbox: { x: number; y: number; w: number; h: number } | null;
  scroll: { x: number; y: number };
}

async function loadSegmentArtifacts(scriptDir: string, recordDir: string) {
  const segDirs = await readdir(scriptDir);
  const scenes: SceneJson[] = [];
  const cursors: Record<string, CursorTrack> = {};
  const audioPaths: Record<string, string[]> = {};
  const audioDurations: Record<string, number> = {};
  const captionWords: Record<string, { word: string; start_ms: number; end_ms: number }[]> = {};
  const rawClips: Record<string, string> = {};
  const liveBboxes: Record<string, LiveBboxEntry[]> = {};

  for (const seg of segDirs) {
    const scriptSeg = join(scriptDir, seg);
    const files = await readdir(scriptSeg);

    const sceneFile = files.find((f) => f.endsWith(".scene.json"));
    if (!sceneFile) continue;

    const scene = JSON.parse(await readFile(join(scriptSeg, sceneFile), "utf8")) as SceneJson;
    scenes.push(scene);

    const audio = files
      .filter((f) => f.endsWith(".mp3"))
      .sort()
      .map((f) => join(scriptSeg, f));
    audioPaths[seg] = audio;

    const timingFile = files.find((f) => f.endsWith(".timing.json"));
    if (timingFile) {
      const t = JSON.parse(
        await readFile(join(scriptSeg, timingFile), "utf8")
      ) as {
        duration_ms: number;
        timing: { word: string; start_ms: number; end_ms: number }[];
      };
      audioDurations[seg] = t.duration_ms;
      captionWords[seg] = t.timing;
    }

    try {
      const recordSeg = join(recordDir, seg);
      const recFiles = await readdir(recordSeg);
      const cursorFile = recFiles.find((f) => f.endsWith(".cursor.json"));
      const mp4 = recFiles.find((f) => f.endsWith(".mp4") || f.endsWith(".webm"));
      const bboxFile = recFiles.find((f) => f.endsWith(".bboxes.json"));

      if (cursorFile) cursors[seg] = JSON.parse(await readFile(join(recordSeg, cursorFile), "utf8"));
      if (mp4) rawClips[seg] = join(recordSeg, mp4);
      if (bboxFile) liveBboxes[seg] = JSON.parse(await readFile(join(recordSeg, bboxFile), "utf8"));
    } catch {}
  }

  // Apply live bboxes to scene actions where matching by t_ms — overrides director-computed bbox.
  // Both highlight AND zoom (when scale !== 1.0) use the live bbox so the camera anchors on the
  // exact element Playwright resolved at record time.
  for (const scene of scenes) {
    const live = liveBboxes[scene.segment_id];
    if (!live || live.length === 0) continue;
    for (const action of scene.actions as Array<{ t_ms: number; highlight?: { bbox?: unknown; target_selector?: string }; zoom?: { scale?: number; bbox?: unknown } }>) {
      const match = live.find((b) => b.t_ms === action.t_ms && b.bbox);
      if (!match || !match.bbox) continue;
      if (action.highlight) action.highlight.bbox = match.bbox;
      if (action.zoom && typeof action.zoom.scale === "number" && action.zoom.scale !== 1.0) {
        action.zoom.bbox = match.bbox;
      }
    }
  }

  return { scenes, cursors, audioPaths, audioDurations, captionWords, rawClips };
}

export async function composeCommand(opts: ComposeCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try {
    config = await loadConfig(projectRoot);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "config load failed");
    return 1;
  }

  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("compose");

  let arts;
  try {
    arts = await loadSegmentArtifacts(join(paths.cache, "script"), join(paths.cache, "record"));
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "missing scan/script/record artifacts; run earlier stages first"
    );
    return 1;
  }

  const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;

  try {
    const result = await runCompose({
      scenes: arts.scenes,
      cursors: arts.cursors,
      audioPaths: arts.audioPaths,
      audioDurations: arts.audioDurations,
      captionWords: arts.captionWords,
      rawClips: arts.rawClips,
      config,
      pluginRoot,
      cacheRoot: paths.cache,
      appName: config.app.name,
    });

    for (const seg of result.segments) {
      await sm.markSegmentStage(seg.id, "compose", "ok");
    }
    await sm.markStageComplete("compose");

    if (opts.printMarkdown !== false) {
      process.stdout.write(
        formatComposeMarkdown({
          draft_path: result.draft_path,
          segments: result.segments,
          total_duration_ms: result.total_duration_ms,
        }) + "\n"
      );
    }

    logger.info({ draft: result.draft_path, srt: result.srt_path }, "compose stage complete");
    return 0;
  } catch (err) {
    const { formatError, renderError } = await import("../ux/error.js");
    process.stderr.write(renderError(formatError(err, "compose")));
    return 1;
  }
}
