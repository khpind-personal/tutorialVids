import { copyFile, mkdir } from "node:fs/promises";
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
    const hdSource = join(paths.cache, "compose", "_stitch", "stitched-hd.mp4");
    const finalDir = join(paths.cache, "final");
    await mkdir(finalDir, { recursive: true });
    const finalOut = join(finalDir, "final.mp4");
    await copyFile(hdSource, finalOut);

    const draftSrt = join(finalDir, "draft.srt");
    const finalSrt = join(finalDir, "final.srt");
    await copyFile(draftSrt, finalSrt);

    await sm.markStageComplete("final");
    logger.info({ final_mp4: finalOut, final_srt: finalSrt }, "finalize complete");
    process.stdout.write(`\n✓ Final video: ${finalOut}\n  Captions: ${finalSrt}\n`);
    // Mark unused parameter to satisfy linter
    void config;
    return 0;
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "finalize")));
    return 1;
  }
}
