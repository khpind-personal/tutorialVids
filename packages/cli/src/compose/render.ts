import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server } from "node:http";
import { createReadStream, statSync } from "node:fs";
import type { ComposeInput, ComposeResult } from "./types.js";
import { buildTimeline } from "./timeline.js";
import { logger } from "../logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(here, "../compose-entry.js");

let bundled: string | null = null;
let assetServer: { url: string; server: Server } | null = null;

async function ensureBundle(): Promise<string> {
  if (bundled) return bundled;
  bundled = await bundle({ entryPoint: ENTRY });
  return bundled;
}

async function ensureAssetServer(): Promise<string> {
  if (assetServer) return assetServer.url;
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      let p = decodeURIComponent(url.pathname);
      // The pathname leads with "/" but the asset paths handed to toUrl are
      // typically relative (e.g. ".tutorialvid/cache/..."). When that happens,
      // resolve from process.cwd() rather than treating "/foo" as a real
      // filesystem path. Genuine absolute paths (under /Users, /home, /var,
      // /tmp) are kept as-is so that fully-qualified asset paths still work.
      if (p.startsWith("/") && !p.startsWith("//")) {
        const stripped = p.replace(/^\/+/, "");
        const looksAbsolute = /^(Users|home|var|tmp|opt|private|System)\b/.test(stripped);
        if (!looksAbsolute) {
          p = resolve(process.cwd(), stripped);
        }
      }
      const st = statSync(p);
      if (!st.isFile()) { res.statusCode = 404; res.end(); return; }
      res.statusCode = 200;
      const ext = p.split(".").pop()?.toLowerCase() ?? "";
      const ct = ext === "mp3" ? "audio/mpeg" : ext === "webm" ? "video/webm" : ext === "mp4" ? "video/mp4" : ext === "svg" ? "image/svg+xml" : "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.setHeader("Content-Length", String(st.size));
      res.setHeader("Access-Control-Allow-Origin", "*");
      createReadStream(p).pipe(res);
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("asset server bind failed");
  const url = `http://127.0.0.1:${addr.port}`;
  assetServer = { url, server };
  return url;
}

export function closeAssetServer(): void {
  if (assetServer) { assetServer.server.close(); assetServer = null; }
}

export async function renderSegment(input: ComposeInput): Promise<ComposeResult> {
  const bundleLocation = await ensureBundle();
  const assetBase = await ensureAssetServer();
  // Always insert a "/" between the asset server origin and the path. Without
  // it, a relative path like ".tutorialvid/..." became
  // "http://127.0.0.1:55173.tutorialvid/..." (the leading "." gets glued onto
  // the port and the URL parser throws ERR_INVALID_URL inside Remotion).
  const toUrl = (p: string) =>
    p.startsWith("http") ? p : `${assetBase}/${encodeURI(p.replace(/^\.?\//, ""))}`;
  const timeline = buildTimeline({
    scene: input.scene,
    cursor: input.cursor,
    audio_duration_ms: input.audio_duration_ms
  });
  const inputProps = {
    rawClipPath: toUrl(input.raw_clip_path),
    audioPaths: input.audio_paths.map(toUrl),
    audioOffsetsMs: input.audio_offsets_ms ?? input.audio_paths.map(() => 0),
    cursorTrack: input.cursor,
    cursorSvgPath: toUrl(input.cursor_svg_path),
    cursorSize: input.cursor_size_px,
    cursorIdleHideMs: input.cursor_idle_hide_ms,
    keyframes: timeline.keyframes,
    captionWords: input.caption_words,
    durationMs: timeline.duration_ms
  };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Segment",
    inputProps
  });
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: input.out_path,
    inputProps
  });
  logger.info({ segment_id: input.scene.segment_id, out: input.out_path }, "segment rendered");
  return { segment_id: input.scene.segment_id, composed_mp4_path: input.out_path, duration_ms: input.audio_duration_ms };
}
