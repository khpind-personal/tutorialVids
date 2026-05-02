import { chromium, type Browser } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { applyAuth, type AuthCredentials } from "./auth.js";
import { CursorRecorder } from "./cursor.js";
import { runActions, type LiveBbox } from "./runner.js";
import { runSeed } from "./seed.js";
import type { SceneJson } from "../script/types.js";
import type { Config } from "../config/schema.js";
import type { RecordSegmentResult, AuthMode } from "./types.js";
import type { Discovery, RoleDef } from "../discovery/types.js";
import { hashInputs } from "../cache/hash.js";
import { logger } from "../logger.js";

export interface RunRecordInput {
  scenes: SceneJson[];
  baseUrl: string;
  config: Config;
  outDirRoot: string;
  storageStatePath?: string;
  authCredentials?: AuthCredentials;
  discovery?: Discovery;
}

interface ResolvedAuth {
  mode: AuthMode;
  storageStatePath?: string;
  credentials?: AuthCredentials;
}

function resolveSegmentAuth(scene: SceneJson, input: RunRecordInput): ResolvedAuth {
  if (input.discovery && !scene.is_common && scene.role !== "common") {
    const role: RoleDef | undefined = input.discovery.roles.find((r) => r.id === scene.role);
    if (role) {
      if (role.auth.mode === "storage_state") {
        return { mode: "storage_state", storageStatePath: role.auth.storage_state_path };
      }
      if (role.auth.mode === "credentials") {
        const defaults = input.config.auth.credentials;
        const creds: AuthCredentials = {
          login_url: role.auth.login_url ?? defaults?.login_url ?? "",
          username_env: role.auth.username_env,
          password_env: role.auth.password_env,
          username_selector: role.auth.username_selector ?? defaults?.username_selector ?? "",
          password_selector: role.auth.password_selector ?? defaults?.password_selector ?? "",
          submit_selector: role.auth.submit_selector ?? defaults?.submit_selector ?? ""
        };
        return { mode: "credentials", credentials: creds };
      }
    }
  }
  if (input.storageStatePath) return { mode: "storage_state", storageStatePath: input.storageStatePath };
  if (input.authCredentials) return { mode: "credentials", credentials: input.authCredentials };
  return { mode: "inline" };
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
      const auth = resolveSegmentAuth(scene, input);
      logger.info(
        { segment: scene.segment_id, role: scene.role, auth_mode: auth.mode, storage_state: auth.storageStatePath },
        "record auth resolved"
      );
      const segDir = join(input.outDirRoot, scene.segment_id);
      await mkdir(segDir, { recursive: true });
      const context = await browser.newContext({
        recordVideo: { dir: segDir, size: input.config.record.viewport },
        viewport: input.config.record.viewport,
        ...(auth.storageStatePath ? { storageState: auth.storageStatePath } : {})
      });
      const page = await context.newPage();

      await applyAuth({
        mode: auth.mode,
        page, context,
        baseUrl: input.baseUrl,
        ...(auth.credentials ? { credentials: auth.credentials } : {}),
        ...(auth.storageStatePath ? { storageStatePath: auth.storageStatePath } : {})
      });

      const cursor = new CursorRecorder();
      cursor.start();
      const liveBboxes: LiveBbox[] = [];
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
          cursor,
          liveBboxes
        });
      } finally {
        const track = cursor.stop();
        duration_ms = Date.now() - start;
        await context.close();
        const video = await page.video();
        mp4_path = video ? await video.path() : "";
        const hash = hashInputs({
          segment_id: scene.segment_id,
          role: scene.role,
          scene_actions: scene.actions.length,
          base_url: input.baseUrl
        });
        cursor_track_path = join(segDir, `${hash}.cursor.json`);
        await writeFile(cursor_track_path, JSON.stringify(track, null, 2));
        const bboxes_path = join(segDir, `${hash}.bboxes.json`);
        await writeFile(bboxes_path, JSON.stringify(liveBboxes, null, 2));
      }
      results.push({ segment_id: scene.segment_id, mp4_path, cursor_track_path, duration_ms });
    }
  } finally {
    await browser.close();
  }
  return results;
}
