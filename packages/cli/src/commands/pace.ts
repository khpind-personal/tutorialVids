import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { paceSegment } from "../pace/index.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";

export interface PaceCommandOpts { cwd: string; printMarkdown?: boolean; }

export async function paceCommand(opts: PaceCommandOpts): Promise<number> {
  let config;
  try { config = await loadConfig(opts.cwd); }
  catch (err) {
    process.stderr.write(renderError(formatError(err, "pace")));
    return 1;
  }
  const paths = cachePaths(opts.cwd);
  const sm = new StateMachine(opts.cwd);
  await sm.load();
  await sm.recordCommand("pace");

  const scriptRoot = join(paths.cache, "script");
  let segDirs: string[];
  try { segDirs = (await readdir(scriptRoot)).filter((s) => !s.startsWith("_")); }
  catch (err) {
    process.stderr.write(renderError(formatError(err, "pace")));
    return 1;
  }

  const lines: string[] = ["# TutorialVid Pace", ""];
  for (const seg of segDirs) {
    try {
      const r = await paceSegment({ scriptDir: join(scriptRoot, seg), segmentId: seg });
      if (r.paced) {
        lines.push(`- ${seg}: target ${(r.prior_target_ms / 1000).toFixed(1)}s → **${(r.new_target_ms / 1000).toFixed(1)}s** across ${r.beat_count} phrase beats`);
        logger.info({ segment: seg, prior_ms: r.prior_target_ms, new_ms: r.new_target_ms, beats: r.beat_count }, "paced");
      } else {
        lines.push(`- ${seg}: skipped (no per-beat phrases or no TTS timing)`);
      }
    } catch (err) {
      process.stderr.write(renderError(formatError(err, "pace")));
      return 1;
    }
  }

  void config;
  if (opts.printMarkdown !== false) process.stdout.write(lines.join("\n") + "\n");
  return 0;
}
