import { chromium, type Browser } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { applyAuth, type AuthCredentials } from "./auth.js";
import { CursorRecorder } from "./cursor.js";
import { runActions } from "./runner.js";
import { runSeed } from "./seed.js";
import type { SceneJson } from "../script/types.js";
import type { Config } from "../config/schema.js";
import type { RecordSegmentResult } from "./types.js";
import { hashInputs } from "../cache/hash.js";

export interface RunRecordInput {
  scenes: SceneJson[];
  baseUrl: string;
  config: Config;
  outDirRoot: string;
  storageStatePath?: string;
  authCredentials?: AuthCredentials;
}

export async function runRecord(input: RunRecordInput): Promise<RecordSegmentResult[]> {
  if (input.config.seed) {
    await runSeed({
      command: input.config.seed.command,
      cwd: process.cwd(),
      ...(input.config.seed.skip_if_exists ? { skipMarkerPath: input.config.seed.skip_if_exists } : {})
    });
  }

  const browser: Browser = await chromium.launch({ headless: input.config.record.headless });
  const results: RecordSegmentResult[] = [];
  try {
    for (const scene of input.scenes) {
      const segDir = join(input.outDirRoot, scene.segment_id);
      await mkdir(segDir, { recursive: true });
      const context = await browser.newContext({
        recordVideo: { dir: segDir, size: input.config.record.viewport },
        viewport: input.config.record.viewport
      });
      const page = await context.newPage();

      const authMode = input.storageStatePath ? "storage_state" : input.authCredentials ? "credentials" : "inline";
      await applyAuth({
        mode: authMode,
        page, context,
        baseUrl: input.baseUrl,
        ...(input.authCredentials ? { credentials: input.authCredentials } : {}),
        ...(input.storageStatePath ? { storageStatePath: input.storageStatePath } : {})
      });

      const cursor = new CursorRecorder();
      cursor.start();
      const start = Date.now();
      let mp4_path = "";
      let cursor_track_path = "";
      let duration_ms = 0;
      try {
        await runActions({
          page, baseUrl: input.baseUrl,
          actions: scene.actions,
          retry: input.config.record.selector_retry,
          retryBackoffMs: input.config.record.selector_retry_backoff_ms,
          cursor
        });
      } finally {
        const track = cursor.stop();
        duration_ms = Date.now() - start;
        await context.close();
        const video = await page.video();
        mp4_path = video ? await video.path() : "";
        const hash = hashInputs({ segment_id: scene.segment_id, scene_actions: scene.actions.length, base_url: input.baseUrl });
        cursor_track_path = join(segDir, `${hash}.cursor.json`);
        await writeFile(cursor_track_path, JSON.stringify(track, null, 2));
      }
      results.push({ segment_id: scene.segment_id, mp4_path, cursor_track_path, duration_ms });
    }
  } finally {
    await browser.close();
  }
  return results;
}
