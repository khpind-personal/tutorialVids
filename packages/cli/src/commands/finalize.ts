import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";

export interface FinalizeCommandOpts {
  cwd: string;
}

export async function finalizeCommand(opts: FinalizeCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try {
    config = await loadConfig(projectRoot);
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "finalize")));
    return 1;
  }

  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("finalize");

  try {
    const finalDir = join(paths.cache, "final");
    await mkdir(finalDir, { recursive: true });
    const composeDir = join(paths.cache, "compose");

    let stitchDirs: string[] = [];
    try {
      const entries = await readdir(composeDir);
      stitchDirs = entries.filter((e) => e.startsWith("_stitch"));
    } catch { stitchDirs = []; }

    if (stitchDirs.length === 0) {
      throw new Error(`no _stitch_<role> dirs under ${composeDir}; run compose first`);
    }

    const promoted: { role: string; mp4: string; srt: string }[] = [];

    for (const dir of stitchDirs) {
      const role = dir === "_stitch" ? "common" : dir.replace(/^_stitch_/, "");
      const hdSource = join(composeDir, dir, "stitched-hd.mp4");
      const finalMp4 = role === "common" && stitchDirs.length === 1
        ? join(finalDir, "final.mp4")
        : join(finalDir, `final.${role}.mp4`);
      await copyFile(hdSource, finalMp4);

      const draftSrt = role === "common" && stitchDirs.length === 1
        ? join(finalDir, "draft.srt")
        : join(finalDir, `draft.${role}.srt`);
      const finalSrt = role === "common" && stitchDirs.length === 1
        ? join(finalDir, "final.srt")
        : join(finalDir, `final.${role}.srt`);
      try { await copyFile(draftSrt, finalSrt); } catch {}

      promoted.push({ role, mp4: finalMp4, srt: finalSrt });
    }

    await sm.markStageComplete("final");
    logger.info({ promoted }, "finalize complete");
    const lines = promoted.map((p) => `\n✓ Final video [${p.role}]: ${p.mp4}\n  Captions: ${p.srt}`);
    process.stdout.write(lines.join("") + "\n");
    void config;
    return 0;
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "finalize")));
    return 1;
  }
}
