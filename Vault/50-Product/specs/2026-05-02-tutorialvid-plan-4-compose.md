# TutorialVid — Plan 4: Compose + Gate 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tutorialvid compose` (Remotion per-segment composition consuming raw mp4 + cursor track + scene directives + tts audio + timing → composed mp4 per segment, then ffmpeg stitch + intro/outro + music + watermark → final draft mp4) with Gate 4 (480p watermarked preview).

**Architecture:** Remotion 4.x renders per-segment React compositions (layers: raw clip background, cursor overlay from track, zoom/pan transform, callouts, captions burn). `ffmpeg-static` + `fluent-ffmpeg` stitches segments + intro/outro + duck-mixed music + watermark. Per-segment renders parallel via Remotion worker pool; ffmpeg stitch serial. Assets bundled in `packages/plugin/templates/{cursor,music,intro,outro}/`. Draft preview = 480p with `DRAFT — TutorialVid` watermark; full-HD final happens in Plan 5.

**Tech Stack additions:** `@remotion/cli` ^4.0.0, `@remotion/renderer` ^4.0.0, `@remotion/bundler` ^4.0.0, `@remotion/google-fonts` ^4.0.0 (caption font), React 18 (JSX in compositions), `fluent-ffmpeg` ^2.1.3, `@ffmpeg-installer/ffmpeg` ^1.1.0, `srt-parser-2` ^1.2.3 (SRT emit/validate).

**Spec:** `docs/specs/2026-05-02-tutorialvid-design.md` §4.6, §8 Gate 4.

**Out of scope (Plan 5):** full-HD finalize, watermark removal flow, telemetry, error UX polish, real audio duration via ffprobe.

---

## Prerequisites

- Plans 1-3 done. Tag `v0.0.3-plan3`.
- `pnpm` and Node 20+ installed.
- Plugin templates dir will be created in Task 2.

---

## File Structure (Plan 4 targets)

```
packages/cli/
├── src/
│   ├── compose/
│   │   ├── types.ts                — ComposeInput, ComposeResult, Layer types
│   │   ├── timeline.ts             — convert scene.json + timing.json → keyframe timeline
│   │   ├── caption.ts              — emit SRT sidecar from timing.json
│   │   ├── srt.ts                  — SRT formatter (mm:ss,ms timestamps)
│   │   ├── components/
│   │   │   ├── SegmentComposition.tsx — top-level Remotion composition
│   │   │   ├── CursorOverlay.tsx       — render cursor track over clip
│   │   │   ├── ZoomLayer.tsx           — apply zoom/pan transform
│   │   │   ├── Callout.tsx             — text bubble + anchor
│   │   │   └── CaptionBar.tsx          — current-word caption highlight
│   │   ├── render.ts               — Remotion render orchestrator (per segment)
│   │   ├── ffmpeg.ts               — fluent-ffmpeg helpers (concat, mux, watermark, duck-mix)
│   │   ├── stitch.ts               — assemble final mp4 from segments + intro/outro
│   │   ├── format.ts               — Gate 4 markdown summary
│   │   └── index.ts                — runCompose() orchestrator
│   ├── commands/
│   │   └── compose.ts              — `tutorialvid compose`
│   ├── remotion.config.ts          — Remotion CLI config (entry point)
│   └── compose-entry.tsx           — Remotion root: registerRoot()
└── tests/
    ├── compose/timeline.test.ts
    ├── compose/srt.test.ts
    ├── compose/caption.test.ts
    ├── compose/ffmpeg.test.ts
    ├── compose/format.test.ts
    └── e2e/compose.test.ts

packages/plugin/templates/
├── cursor/
│   ├── friendly.svg
│   ├── pro.svg
│   ├── hype.svg
│   ├── founder.svg
│   └── documentary.svg
├── music/
│   ├── friendly.mp3        — license-free per-tone backing track
│   ├── pro.mp3
│   ├── hype.mp3
│   ├── founder.mp3
│   └── documentary.mp3
├── intro/
│   └── minimal.json        — Remotion intro spec (logo placement, color)
└── outro/
    └── cta-link.json       — Remotion outro spec (CTA text + URL)
```

---

## Task 1: Add Remotion + ffmpeg deps; extend config for compose

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/config/schema.ts` — add `compose` block before `telemetry`

- [ ] **Step 1: Install deps**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli add remotion@^4.0.0 @remotion/cli@^4.0.0 @remotion/renderer@^4.0.0 @remotion/bundler@^4.0.0 @remotion/google-fonts@^4.0.0 react@^18.3.1 react-dom@^18.3.1 fluent-ffmpeg@^2.1.3 @ffmpeg-installer/ffmpeg@^1.1.0 srt-parser-2@^1.2.3
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli add -D @types/react@^18.3.0 @types/fluent-ffmpeg@^2.1.24
```

If any version unavailable on npm, use the latest stable + report version chosen.

- [ ] **Step 2: Extend `tsconfig.json`** — add JSX support

In `packages/cli/tsconfig.json`, set `compilerOptions.jsx` to `"react-jsx"` and add `"DOM"` to `lib`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Extend `config/schema.ts`** — add `compose` block before `telemetry`:

```typescript
  compose: z.object({
    draft_resolution: z.string().regex(/^\d+x\d+$/).default("854x480"),
    final_resolution: z.string().regex(/^\d+x\d+$/).default("1920x1080"),
    fps: z.number().int().positive().default(30),
    watermark_text: z.string().default("DRAFT — TutorialVid"),
    music_volume: z.number().min(0).max(1).default(0.15),  // duck-mixed under TTS
    intro_template: z.string().default("minimal"),
    outro_template: z.string().default("cta-link"),
    outro_cta: z.string().optional(),
    music_override_path: z.string().optional(),
    cursor_size_px: z.number().int().positive().default(48),
    cursor_idle_hide_ms: z.number().int().positive().default(2000),
    parallel_segment_renders: z.number().int().positive().default(2)
  }).default({
    draft_resolution: "854x480",
    final_resolution: "1920x1080",
    fps: 30,
    watermark_text: "DRAFT — TutorialVid",
    music_volume: 0.15,
    intro_template: "minimal",
    outro_template: "cta-link",
    cursor_size_px: 48,
    cursor_idle_hide_ms: 2000,
    parallel_segment_renders: 2
  }),
```

- [ ] **Step 4: Add config test**

In `tests/config/load.test.ts`, append:

```typescript
  it("provides compose defaults", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.compose.draft_resolution).toBe("854x480");
    expect(cfg.compose.fps).toBe(30);
    expect(cfg.compose.music_volume).toBe(0.15);
    expect(cfg.compose.cursor_size_px).toBe(48);
  });
```

- [ ] **Step 5: Run tests + build**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test config/load
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/package.json packages/cli/tsconfig.json packages/cli/src/config/schema.ts packages/cli/tests pnpm-lock.yaml
git commit -m "feat(cli): add Remotion + ffmpeg deps; extend config with compose block"
```

---

## Task 2: Plugin templates — cursor SVGs + music + intro/outro specs

**Files:**
- Create: `packages/plugin/templates/cursor/{friendly,pro,hype,founder,documentary}.svg`
- Create: `packages/plugin/templates/music/{friendly,pro,hype,founder,documentary}.mp3` (placeholders — see note)
- Create: `packages/plugin/templates/intro/minimal.json`
- Create: `packages/plugin/templates/outro/cta-link.json`

> **Music asset note:** Plan 4 ships placeholder silent mp3s (1 second of silence) so the pipeline runs end-to-end. Plan 5 polish should source 5 real CC0 / royalty-free tracks via Pixabay/Free Music Archive and replace these placeholders.

- [ ] **Step 1: Create cursor SVGs (5 files)** — distinct per-tone styling. Pattern: 32×32 viewBox, fill matches tone palette, stroke 1.5px white for visibility on any background.

`friendly.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M6 4 L6 26 L13 21 L17 28 L21 26 L17 19 L26 17 Z" fill="#7C3AED" stroke="#FFF" stroke-width="1.5"/>
</svg>
```

`pro.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M6 4 L6 26 L13 21 L17 28 L21 26 L17 19 L26 17 Z" fill="#1F2937" stroke="#FFF" stroke-width="1.5"/>
</svg>
```

`hype.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M6 4 L6 26 L13 21 L17 28 L21 26 L17 19 L26 17 Z" fill="#F59E0B" stroke="#FFF" stroke-width="2"/>
</svg>
```

`founder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M6 4 L6 26 L13 21 L17 28 L21 26 L17 19 L26 17 Z" fill="#10B981" stroke="#FFF" stroke-width="1.5"/>
</svg>
```

`documentary.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M6 4 L6 26 L13 21 L17 28 L21 26 L17 19 L26 17 Z" fill="#3B82F6" stroke="#FFF" stroke-width="1.5"/>
</svg>
```

- [ ] **Step 2: Create silent placeholder mp3s** for each tone. Use ffmpeg to generate 1s silence:

```bash
mkdir -p /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/music
cd /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/music
for tone in friendly pro hype founder documentary; do
  ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -q:a 9 -acodec libmp3lame "$tone.mp3" 2>/dev/null
done
```

If ffmpeg isn't on PATH yet (Plan 1 didn't install it system-wide), the bundled `ffmpeg-static` binary path is at `node_modules/@ffmpeg-installer/<platform>/ffmpeg`. Use that path instead:

```bash
FFMPEG=$(find /Users/hariprasadk/Documents/TutorialVid/node_modules/@ffmpeg-installer -name ffmpeg -type f | head -1)
for tone in friendly pro hype founder documentary; do
  "$FFMPEG" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -q:a 9 -acodec libmp3lame "$tone.mp3" 2>/dev/null
done
```

- [ ] **Step 3: Create intro template `intro/minimal.json`**

```json
{
  "name": "minimal",
  "duration_s": 3,
  "background": "#FFFFFF",
  "logo": { "anchor": "center", "max_width_pct": 30, "max_height_pct": 30 },
  "title_text": "{{app.name}}",
  "title_color": "#1F2937",
  "title_font_size": 64
}
```

- [ ] **Step 4: Create outro template `outro/cta-link.json`**

```json
{
  "name": "cta-link",
  "duration_s": 5,
  "background": "#1F2937",
  "title_text": "Try it free at",
  "title_color": "#FFFFFF",
  "title_font_size": 48,
  "cta_text": "{{compose.outro_cta}}",
  "cta_color": "#7C3AED",
  "cta_font_size": 56
}
```

- [ ] **Step 5: Verify all assets exist**

```bash
ls -la /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/cursor/*.svg
ls -la /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/music/*.mp3
ls -la /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/intro/*.json
ls -la /Users/hariprasadk/Documents/TutorialVid/packages/plugin/templates/outro/*.json
```

Expected: 5 SVGs + 5 MP3s + 1 intro JSON + 1 outro JSON.

- [ ] **Step 6: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin/templates
git commit -m "feat(plugin): add cursor SVGs + silent music placeholders + intro/outro templates"
```

---

## Task 3: Compose types + timeline builder

**Files:**
- Create: `packages/cli/src/compose/types.ts`
- Create: `packages/cli/src/compose/timeline.ts`
- Create: `packages/cli/tests/compose/timeline.test.ts`

- [ ] **Step 1: `packages/cli/src/compose/types.ts`**

```typescript
import type { SceneJson, SceneAction } from "../script/types.js";
import type { CursorTrack, CursorEvent } from "../record/types.js";

export interface TimelineKeyframe {
  t_ms: number;
  zoom?: { scale: number; x_pct: number; y_pct: number };
  callout?: { text: string; anchor: "left" | "right" | "top" | "bottom"; visible: boolean };
  ripple?: { x_pct: number; y_pct: number };
}

export interface SegmentTimeline {
  segment_id: string;
  duration_ms: number;
  keyframes: TimelineKeyframe[];
  cursor: CursorTrack;
  caption_words: { word: string; start_ms: number; end_ms: number }[];
  audio_paths: string[];        // mp3 chunks in order
  raw_clip_path: string;
  zoom_default_centre: { x_pct: number; y_pct: number };
}

export interface ComposeInput {
  scene: SceneJson;
  cursor: CursorTrack;
  audio_paths: string[];
  audio_duration_ms: number;
  caption_words: { word: string; start_ms: number; end_ms: number }[];
  raw_clip_path: string;
  out_path: string;
  resolution: { width: number; height: number };
  fps: number;
  cursor_svg_path: string;
  cursor_size_px: number;
  cursor_idle_hide_ms: number;
}

export interface ComposeResult {
  segment_id: string;
  composed_mp4_path: string;
  duration_ms: number;
}
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/compose/timeline.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildTimeline } from "../../src/compose/timeline.js";
import type { SceneJson } from "../../src/script/types.js";
import type { CursorTrack } from "../../src/record/types.js";

const scene: SceneJson = {
  segment_id: "s01_x", page_id: "x", depth: "medium", tone: "friendly", target_duration_s: 10,
  actions: [
    { t_ms: 0, type: "nav", url: "/x" },
    { t_ms: 1000, type: "click", selector: "[data-test=btn]",
      zoom: { scale: 2.0, in_ms: 200, hold_ms: 600, out_ms: 200 },
      ripple: true,
      callout: { text: "click here", anchor: "right", duration_ms: 1500 } }
  ],
  narration: { text: "x", ssml: "<speak>x</speak>", alignments: [] }
};

const cursor: CursorTrack = { events: [{ t_ms: 0, x: 100, y: 200, event: "move" }] };

describe("buildTimeline", () => {
  it("emits zoom keyframes around click events", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const zoomKfs = t.keyframes.filter(k => k.zoom);
    expect(zoomKfs.length).toBeGreaterThanOrEqual(2);
    const peak = zoomKfs.find(k => k.zoom?.scale === 2.0);
    expect(peak).toBeDefined();
  });

  it("emits a callout keyframe block matching the click action", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const callouts = t.keyframes.filter(k => k.callout);
    expect(callouts.length).toBeGreaterThanOrEqual(2);
    expect(callouts.find(k => k.callout?.text === "click here" && k.callout.visible)).toBeDefined();
  });

  it("emits a ripple keyframe at click t_ms", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    const ripples = t.keyframes.filter(k => k.ripple);
    expect(ripples.length).toBe(1);
    expect(ripples[0]?.t_ms).toBe(1000);
  });

  it("uses audio_duration_ms as the timeline duration", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 7777 });
    expect(t.duration_ms).toBe(7777);
  });

  it("sorts keyframes by t_ms", () => {
    const t = buildTimeline({ scene, cursor, audio_duration_ms: 5000 });
    for (let i = 1; i < t.keyframes.length; i++) {
      expect(t.keyframes[i]!.t_ms).toBeGreaterThanOrEqual(t.keyframes[i - 1]!.t_ms);
    }
  });
});
```

- [ ] **Step 3: Verify FAIL + Implement `packages/cli/src/compose/timeline.ts`**

```typescript
import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";
import type { TimelineKeyframe } from "./types.js";

export interface BuildTimelineInput {
  scene: SceneJson;
  cursor: CursorTrack;
  audio_duration_ms: number;
}

export interface Timeline {
  duration_ms: number;
  keyframes: TimelineKeyframe[];
}

export function buildTimeline(input: BuildTimelineInput): Timeline {
  const kfs: TimelineKeyframe[] = [];
  for (const a of input.scene.actions) {
    if (a.zoom) {
      const start = a.t_ms;
      const peakStart = start + a.zoom.in_ms;
      const peakEnd = peakStart + a.zoom.hold_ms;
      const end = peakEnd + a.zoom.out_ms;
      kfs.push({ t_ms: start, zoom: { scale: 1.0, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: peakStart, zoom: { scale: a.zoom.scale, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: peakEnd, zoom: { scale: a.zoom.scale, x_pct: 50, y_pct: 50 } });
      kfs.push({ t_ms: end, zoom: { scale: 1.0, x_pct: 50, y_pct: 50 } });
    }
    if (a.ripple && a.type === "click") {
      kfs.push({ t_ms: a.t_ms, ripple: { x_pct: 50, y_pct: 50 } });
    }
    if (a.callout) {
      kfs.push({ t_ms: a.t_ms, callout: { text: a.callout.text, anchor: a.callout.anchor, visible: true } });
      kfs.push({ t_ms: a.t_ms + a.callout.duration_ms, callout: { text: a.callout.text, anchor: a.callout.anchor, visible: false } });
    }
  }
  kfs.sort((a, b) => a.t_ms - b.t_ms);
  return { duration_ms: input.audio_duration_ms, keyframes: kfs };
}
```

> **Note:** zoom centre `x_pct/y_pct` defaults to 50/50 in this implementation. Plan 5 polish: derive actual centre from cursor track at the click moment.

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test compose/timeline
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/types.ts packages/cli/src/compose/timeline.ts packages/cli/tests/compose/timeline.test.ts
git commit -m "feat(compose): timeline builder (zoom + ripple + callout keyframes)"
```

---

## Task 4: SRT emitter + caption helpers

**Files:**
- Create: `packages/cli/src/compose/srt.ts`
- Create: `packages/cli/src/compose/caption.ts`
- Create: `packages/cli/tests/compose/srt.test.ts`
- Create: `packages/cli/tests/compose/caption.test.ts`

- [ ] **Step 1: Write FAILING tests**

`tests/compose/srt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { wordsToSrt, msToSrtTimestamp } from "../../src/compose/srt.js";

describe("msToSrtTimestamp", () => {
  it("formats ms as hh:mm:ss,ms", () => {
    expect(msToSrtTimestamp(0)).toBe("00:00:00,000");
    expect(msToSrtTimestamp(1234)).toBe("00:00:01,234");
    expect(msToSrtTimestamp(61_500)).toBe("00:01:01,500");
    expect(msToSrtTimestamp(3_661_999)).toBe("01:01:01,999");
  });
});

describe("wordsToSrt", () => {
  it("groups words into 5-word lines per cue", () => {
    const words = Array.from({ length: 12 }).map((_, i) => ({
      word: `w${i}`, start_ms: i * 500, end_ms: (i + 1) * 500
    }));
    const srt = wordsToSrt(words, 5);
    const cues = srt.split(/\n\n/).filter(Boolean);
    expect(cues.length).toBe(3);   // 5 + 5 + 2
    expect(cues[0]).toMatch(/^1\n00:00:00,000 --> 00:00:02,500/);
  });

  it("returns empty string for no words", () => {
    expect(wordsToSrt([], 5)).toBe("");
  });
});
```

`tests/compose/caption.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { activeWordAt } from "../../src/compose/caption.js";

const words = [
  { word: "Hello", start_ms: 0, end_ms: 500 },
  { word: "world", start_ms: 500, end_ms: 1100 },
  { word: "now", start_ms: 1100, end_ms: 1600 }
];

describe("activeWordAt", () => {
  it("returns the word whose interval contains t_ms", () => {
    expect(activeWordAt(words, 0)?.word).toBe("Hello");
    expect(activeWordAt(words, 250)?.word).toBe("Hello");
    expect(activeWordAt(words, 600)?.word).toBe("world");
    expect(activeWordAt(words, 1500)?.word).toBe("now");
  });
  it("returns null after the last word", () => {
    expect(activeWordAt(words, 2000)).toBeNull();
  });
  it("returns null before the first word", () => {
    expect(activeWordAt(words, -10)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/compose/srt.ts`**

```typescript
export function msToSrtTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)},${pad(millis, 3)}`;
}

export interface SrtWord { word: string; start_ms: number; end_ms: number; }

export function wordsToSrt(words: SrtWord[], wordsPerCue = 5): string {
  if (words.length === 0) return "";
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    const start = group[0]!.start_ms;
    const end = group[group.length - 1]!.end_ms;
    const text = group.map((w) => w.word).join(" ");
    const idx = Math.floor(i / wordsPerCue) + 1;
    cues.push(`${idx}\n${msToSrtTimestamp(start)} --> ${msToSrtTimestamp(end)}\n${text}`);
  }
  return cues.join("\n\n");
}
```

- [ ] **Step 3: Implement `packages/cli/src/compose/caption.ts`**

```typescript
import type { SrtWord } from "./srt.js";

export function activeWordAt(words: SrtWord[], t_ms: number): SrtWord | null {
  if (t_ms < (words[0]?.start_ms ?? 0)) return null;
  for (const w of words) {
    if (t_ms >= w.start_ms && t_ms < w.end_ms) return w;
  }
  return null;
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test compose/srt compose/caption
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/srt.ts packages/cli/src/compose/caption.ts packages/cli/tests/compose/srt.test.ts packages/cli/tests/compose/caption.test.ts
git commit -m "feat(compose): SRT emitter + activeWordAt caption helper"
```

---

## Task 5: Remotion components — CursorOverlay, ZoomLayer, Callout, CaptionBar, SegmentComposition

**Files:**
- Create: `packages/cli/src/compose/components/CursorOverlay.tsx`
- Create: `packages/cli/src/compose/components/ZoomLayer.tsx`
- Create: `packages/cli/src/compose/components/Callout.tsx`
- Create: `packages/cli/src/compose/components/CaptionBar.tsx`
- Create: `packages/cli/src/compose/components/SegmentComposition.tsx`

> No tests for components — they're rendered by Remotion in the E2E test (Task 13). Component code is mechanical JSX.

- [ ] **Step 1: `CursorOverlay.tsx`**

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CursorTrack } from "../../record/types.js";

interface Props {
  track: CursorTrack;
  svgPath: string;       // resolved file path or staticFile()
  sizePx: number;
  idleHideMs: number;
  totalDurationMs: number;
}

function findCursorAt(track: CursorTrack, t_ms: number): { x: number; y: number; event: string } | null {
  let last = null as { x: number; y: number; event: string } | null;
  for (const e of track.events) {
    if (e.t_ms <= t_ms) last = { x: e.x, y: e.y, event: e.event };
    else break;
  }
  return last;
}

export function CursorOverlay({ track, svgPath, sizePx, idleHideMs }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const pos = findCursorAt(track, t_ms);
  if (!pos) return null;
  // Idle hide: if no event in the last idleHideMs, hide
  const lastEvent = track.events.filter((e) => e.t_ms <= t_ms).pop();
  const sinceLast = lastEvent ? t_ms - lastEvent.t_ms : Infinity;
  const opacity = sinceLast > idleHideMs ? 0 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, transition: "opacity 200ms" }}>
      <img src={svgPath} alt="cursor"
        style={{ position: "absolute", left: pos.x - sizePx / 2, top: pos.y - sizePx / 2, width: sizePx, height: sizePx }} />
      {pos.event === "down" && (
        <div style={{
          position: "absolute", left: pos.x - 24, top: pos.y - 24,
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(255,255,255,0.6)", animation: "ripple 600ms ease-out"
        }} />
      )}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: `ZoomLayer.tsx`**

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { TimelineKeyframe } from "../types.js";
import type { ReactNode } from "react";

interface Props { keyframes: TimelineKeyframe[]; children: ReactNode; }

export function ZoomLayer({ keyframes, children }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const zoomKfs = keyframes.filter((k) => k.zoom);
  if (zoomKfs.length === 0) return <>{children}</>;
  const inputRange = zoomKfs.map((k) => k.t_ms);
  const scaleRange = zoomKfs.map((k) => k.zoom!.scale);
  const xRange = zoomKfs.map((k) => k.zoom!.x_pct);
  const yRange = zoomKfs.map((k) => k.zoom!.y_pct);
  const scale = interpolate(t_ms, inputRange, scaleRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const xPct = interpolate(t_ms, inputRange, xRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const yPct = interpolate(t_ms, inputRange, yRange, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ width: "100%", height: "100%", transformOrigin: `${xPct}% ${yPct}%`, transform: `scale(${scale})` }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `Callout.tsx`**

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { TimelineKeyframe } from "../types.js";

interface Props { keyframes: TimelineKeyframe[]; }

export function Callout({ keyframes }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const calloutKfs = keyframes.filter((k) => k.callout);
  let active: TimelineKeyframe["callout"] | undefined;
  for (const k of calloutKfs) {
    if (k.t_ms <= t_ms && k.callout) {
      active = k.callout.visible ? k.callout : undefined;
    }
  }
  if (!active) return null;
  const anchorStyle =
    active.anchor === "right" ? { right: 80, top: "40%" } :
    active.anchor === "left" ? { left: 80, top: "40%" } :
    active.anchor === "top" ? { top: 80, left: "40%" } :
    { bottom: 80, left: "40%" };
  return (
    <div style={{
      position: "absolute", ...anchorStyle,
      background: "rgba(31,41,55,0.95)", color: "white",
      padding: "12px 18px", borderRadius: 8, maxWidth: 320, fontSize: 22, fontFamily: "system-ui"
    }}>{active.text}</div>
  );
}
```

- [ ] **Step 4: `CaptionBar.tsx`**

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";
import { activeWordAt, type SrtWord } from "../caption.js";

interface Props { words: SrtWord[]; }

export function CaptionBar({ words }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const active = activeWordAt(words, t_ms);
  // Render the line containing the active word: 7-word window centred on active.
  if (!active) return null;
  const idx = words.indexOf(active);
  const start = Math.max(0, idx - 3);
  const window = words.slice(start, start + 7);
  return (
    <div style={{
      position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.7)", color: "white",
      padding: "10px 18px", borderRadius: 6, fontSize: 28, fontFamily: "system-ui"
    }}>
      {window.map((w) => (
        <span key={w.start_ms} style={{ marginRight: 8, color: w === active ? "#FBBF24" : "white" }}>{w.word}</span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `SegmentComposition.tsx`**

```tsx
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from "remotion";
import { ZoomLayer } from "./ZoomLayer.js";
import { CursorOverlay } from "./CursorOverlay.js";
import { Callout } from "./Callout.js";
import { CaptionBar } from "./CaptionBar.js";
import type { TimelineKeyframe } from "../types.js";
import type { CursorTrack } from "../../record/types.js";
import type { SrtWord } from "../srt.js";

export interface SegmentCompositionProps {
  rawClipPath: string;
  audioPaths: string[];
  cursorTrack: CursorTrack;
  cursorSvgPath: string;
  cursorSize: number;
  cursorIdleHideMs: number;
  keyframes: TimelineKeyframe[];
  captionWords: SrtWord[];
  durationMs: number;
}

export function SegmentComposition(props: SegmentCompositionProps) {
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <ZoomLayer keyframes={props.keyframes}>
        <OffthreadVideo src={props.rawClipPath} muted />
      </ZoomLayer>
      <CursorOverlay
        track={props.cursorTrack}
        svgPath={props.cursorSvgPath}
        sizePx={props.cursorSize}
        idleHideMs={props.cursorIdleHideMs}
        totalDurationMs={props.durationMs}
      />
      <Callout keyframes={props.keyframes} />
      <CaptionBar words={props.captionWords} />
      {props.audioPaths.map((p, i) => <Audio key={i} src={p} />)}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 6: Build clean (no test for components yet)**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

If TS strict complains about React types not being available, double-check Step 1 of Task 1 installed `@types/react`.

- [ ] **Step 7: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/components
git commit -m "feat(compose): Remotion components (CursorOverlay, ZoomLayer, Callout, CaptionBar, SegmentComposition)"
```

---

## Task 6: Remotion entrypoint + render orchestrator

**Files:**
- Create: `packages/cli/src/compose-entry.tsx`
- Create: `packages/cli/remotion.config.ts`
- Create: `packages/cli/src/compose/render.ts`

- [ ] **Step 1: `packages/cli/src/compose-entry.tsx`**

```tsx
import { Composition, registerRoot } from "remotion";
import { SegmentComposition, type SegmentCompositionProps } from "./compose/components/SegmentComposition.js";

const DEFAULT_PROPS: SegmentCompositionProps = {
  rawClipPath: "",
  audioPaths: [],
  cursorTrack: { events: [] },
  cursorSvgPath: "",
  cursorSize: 48,
  cursorIdleHideMs: 2000,
  keyframes: [],
  captionWords: [],
  durationMs: 1000
};

const Root: React.FC = () => (
  <Composition
    id="Segment"
    component={SegmentComposition as React.ComponentType<SegmentCompositionProps>}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={300}
    defaultProps={DEFAULT_PROPS}
    calculateMetadata={({ props }) => {
      const fps = 30;
      const durationInFrames = Math.max(1, Math.round((props.durationMs / 1000) * fps));
      return { durationInFrames };
    }}
  />
);

registerRoot(Root);
```

- [ ] **Step 2: `packages/cli/remotion.config.ts`**

```typescript
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 3: `packages/cli/src/compose/render.ts`**

```typescript
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComposeInput, ComposeResult, SegmentTimeline } from "./types.js";
import { buildTimeline } from "./timeline.js";
import { logger } from "../logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(here, "../../src/compose-entry.tsx");

let bundled: string | null = null;

async function ensureBundle(): Promise<string> {
  if (bundled) return bundled;
  bundled = await bundle({ entryPoint: ENTRY });
  return bundled;
}

export async function renderSegment(input: ComposeInput): Promise<ComposeResult> {
  const bundleLocation = await ensureBundle();
  const timeline = buildTimeline({
    scene: input.scene,
    cursor: input.cursor,
    audio_duration_ms: input.audio_duration_ms
  });
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Segment",
    inputProps: {
      rawClipPath: input.raw_clip_path,
      audioPaths: input.audio_paths,
      cursorTrack: input.cursor,
      cursorSvgPath: input.cursor_svg_path,
      cursorSize: input.cursor_size_px,
      cursorIdleHideMs: input.cursor_idle_hide_ms,
      keyframes: timeline.keyframes,
      captionWords: input.caption_words,
      durationMs: timeline.duration_ms
    }
  });
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: input.out_path,
    inputProps: {
      rawClipPath: input.raw_clip_path,
      audioPaths: input.audio_paths,
      cursorTrack: input.cursor,
      cursorSvgPath: input.cursor_svg_path,
      cursorSize: input.cursor_size_px,
      cursorIdleHideMs: input.cursor_idle_hide_ms,
      keyframes: timeline.keyframes,
      captionWords: input.caption_words,
      durationMs: timeline.duration_ms
    }
  });
  logger.info({ segment_id: input.scene.segment_id, out: input.out_path }, "segment rendered");
  return { segment_id: input.scene.segment_id, composed_mp4_path: input.out_path, duration_ms: input.audio_duration_ms };
}
```

- [ ] **Step 4: Build clean**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose-entry.tsx packages/cli/remotion.config.ts packages/cli/src/compose/render.ts
git commit -m "feat(compose): Remotion entrypoint + per-segment renderMedia orchestrator"
```

---

## Task 7: ffmpeg helpers (concat, mux, watermark, duck-mix)

**Files:**
- Create: `packages/cli/src/compose/ffmpeg.ts`
- Create: `packages/cli/tests/compose/ffmpeg.test.ts`

- [ ] **Step 1: Write FAILING test (mocked fluent-ffmpeg)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { concatSegments, applyWatermark, duckMixMusic } from "../../src/compose/ffmpeg.js";

const runMock = vi.fn();
const inputMock = vi.fn();
const outputMock = vi.fn();
const onMock = vi.fn();
const audioFiltersMock = vi.fn();
const videoFiltersMock = vi.fn();
const complexFilterMock = vi.fn();
const outputOptionsMock = vi.fn();

const fakeChain: Record<string, (...args: unknown[]) => unknown> = {};
const chainObj = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === "run") return runMock;
    if (prop === "on") return (...args: unknown[]) => { onMock(...args); return chainObj; };
    return (...args: unknown[]) => { (fakeChain[String(prop)] ?? ((..._args: unknown[]) => undefined))(...args); return chainObj; };
  }
});

vi.mock("fluent-ffmpeg", () => {
  const fn = vi.fn(() => chainObj);
  (fn as unknown as { setFfmpegPath: (p: string) => void }).setFfmpegPath = vi.fn();
  return { default: fn };
});

beforeEach(() => {
  runMock.mockReset(); inputMock.mockReset(); outputMock.mockReset(); onMock.mockReset();
  fakeChain.input = inputMock; fakeChain.output = outputMock;
  fakeChain.audioFilters = audioFiltersMock; fakeChain.videoFilters = videoFiltersMock;
  fakeChain.complexFilter = complexFilterMock; fakeChain.outputOptions = outputOptionsMock;
  // simulate end event firing immediately
  onMock.mockImplementation(((event: string, cb: () => void) => {
    if (event === "end") setTimeout(cb, 0);
  }) as unknown as typeof onMock);
  runMock.mockImplementation(() => undefined);
});

describe("concatSegments", () => {
  it("invokes ffmpeg.concat with each input + output", async () => {
    await concatSegments(["a.mp4", "b.mp4"], "out.mp4");
    expect(inputMock).toHaveBeenCalledTimes(2);
    expect(outputMock).toHaveBeenCalledWith("out.mp4");
  });
});

describe("applyWatermark", () => {
  it("uses drawtext filter with the supplied text", async () => {
    await applyWatermark("in.mp4", "out.mp4", "DRAFT");
    expect(videoFiltersMock).toHaveBeenCalled();
    const call = videoFiltersMock.mock.calls[0]?.[0];
    expect(JSON.stringify(call)).toMatch(/DRAFT/);
  });
});

describe("duckMixMusic", () => {
  it("uses sidechaincompress filter to duck music under voice", async () => {
    await duckMixMusic({ videoIn: "v.mp4", musicIn: "m.mp3", out: "out.mp4", musicVolume: 0.15 });
    expect(complexFilterMock).toHaveBeenCalled();
    expect(outputMock).toHaveBeenCalledWith("out.mp4");
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/compose/ffmpeg.ts`**

```typescript
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

(ffmpeg as unknown as { setFfmpegPath: (p: string) => void }).setFfmpegPath(ffmpegInstaller.path);

function run(chain: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    chain.on("end", () => resolve()).on("error", (e: Error) => reject(e)).run();
  });
}

export async function concatSegments(inputs: string[], out: string): Promise<void> {
  const chain = ffmpeg();
  for (const i of inputs) chain.input(i);
  chain.outputOptions(["-filter_complex", `concat=n=${inputs.length}:v=1:a=1`]);
  chain.output(out);
  await run(chain);
}

export async function applyWatermark(inPath: string, outPath: string, text: string): Promise<void> {
  const chain = ffmpeg(inPath);
  chain.videoFilters([{
    filter: "drawtext",
    options: { text, fontsize: 36, fontcolor: "white@0.7", x: "w-tw-20", y: "20", box: 1, boxcolor: "black@0.4", boxborderw: 8 }
  }]);
  chain.output(outPath);
  await run(chain);
}

export interface DuckMixInput { videoIn: string; musicIn: string; out: string; musicVolume: number; }

export async function duckMixMusic(input: DuckMixInput): Promise<void> {
  const chain = ffmpeg();
  chain.input(input.videoIn);
  chain.input(input.musicIn);
  chain.complexFilter([
    `[1:a]volume=${input.musicVolume}[music_low]`,
    `[0:a][music_low]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[mix]`
  ], ["mix"]);
  chain.outputOptions(["-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-shortest"]);
  chain.output(input.out);
  await run(chain);
}

export async function downscaleTo480p(inPath: string, outPath: string): Promise<void> {
  const chain = ffmpeg(inPath);
  chain.videoFilters([{ filter: "scale", options: { w: 854, h: 480 } }]);
  chain.output(outPath);
  await run(chain);
}
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test compose/ffmpeg
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/ffmpeg.ts packages/cli/tests/compose/ffmpeg.test.ts
git commit -m "feat(compose): ffmpeg helpers (concat + watermark + duck-mix + downscale)"
```

---

## Task 8: Stitch helpers (intro/outro placeholders + concat-with-music)

**Files:**
- Create: `packages/cli/src/compose/stitch.ts`

> Intro/outro rendering uses simple ffmpeg-generated title cards in v0.0.4. Plan 5 polish replaces with Remotion-rendered intro/outro.

- [ ] **Step 1: Implement `packages/cli/src/compose/stitch.ts`**

```typescript
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { concatSegments, duckMixMusic } from "./ffmpeg.js";

export interface StitchInput {
  segmentMp4s: string[];
  introTemplatePath: string;     // intro/<name>.json
  outroTemplatePath: string;     // outro/<name>.json
  musicPath: string;
  musicVolume: number;
  appName: string;
  outroCta: string | undefined;
  workDir: string;
  finalOut: string;
  resolution: { width: number; height: number };
}

interface IntroSpec {
  name: string;
  duration_s: number;
  background: string;
  title_text: string;
  title_color: string;
  title_font_size: number;
}
interface OutroSpec extends IntroSpec {
  cta_text: string;
  cta_color: string;
  cta_font_size: number;
}

function run(chain: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    chain.on("end", () => resolve()).on("error", (e: Error) => reject(e)).run();
  });
}

async function renderTitleCard(opts: { text: string; subtext?: string; bg: string; fg: string; subFg?: string; durationS: number; fontSize: number; subFontSize?: number; out: string; resolution: { width: number; height: number }; }): Promise<void> {
  const chain = ffmpeg();
  chain.input(`color=c=${opts.bg.replace("#", "0x")}:s=${opts.resolution.width}x${opts.resolution.height}:d=${opts.durationS}`);
  chain.inputOptions(["-f", "lavfi"]);
  const filters: { filter: string; options: Record<string, string | number> }[] = [
    { filter: "drawtext", options: { text: opts.text, fontsize: opts.fontSize, fontcolor: opts.fg, x: "(w-tw)/2", y: "(h-th)/2 - 50" } }
  ];
  if (opts.subtext) {
    filters.push({ filter: "drawtext", options: { text: opts.subtext, fontsize: opts.subFontSize ?? 32, fontcolor: opts.subFg ?? opts.fg, x: "(w-tw)/2", y: "(h-th)/2 + 50" } });
  }
  chain.videoFilters(filters);
  chain.outputOptions(["-pix_fmt", "yuv420p", "-t", String(opts.durationS)]);
  chain.output(opts.out);
  await run(chain);
}

export async function stitchFinal(input: StitchInput): Promise<string> {
  await mkdir(input.workDir, { recursive: true });
  const intro = JSON.parse(await readFile(input.introTemplatePath, "utf8")) as IntroSpec;
  const outro = JSON.parse(await readFile(input.outroTemplatePath, "utf8")) as OutroSpec;

  const introMp4 = join(input.workDir, "intro.mp4");
  const outroMp4 = join(input.workDir, "outro.mp4");
  await renderTitleCard({
    text: intro.title_text.replace("{{app.name}}", input.appName),
    bg: intro.background, fg: intro.title_color, durationS: intro.duration_s, fontSize: intro.title_font_size,
    out: introMp4, resolution: input.resolution
  });
  await renderTitleCard({
    text: outro.title_text,
    subtext: outro.cta_text.replace("{{compose.outro_cta}}", input.outroCta ?? "example.com"),
    bg: outro.background, fg: outro.title_color, subFg: outro.cta_color,
    durationS: outro.duration_s, fontSize: outro.title_font_size, subFontSize: outro.cta_font_size,
    out: outroMp4, resolution: input.resolution
  });

  const concatOut = join(input.workDir, "concat.mp4");
  await concatSegments([introMp4, ...input.segmentMp4s, outroMp4], concatOut);

  await duckMixMusic({ videoIn: concatOut, musicIn: input.musicPath, out: input.finalOut, musicVolume: input.musicVolume });

  return input.finalOut;
}
```

- [ ] **Step 2: Build clean**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/stitch.ts
git commit -m "feat(compose): stitch helpers (intro+outro title cards + concat-with-music)"
```

---

## Task 9: Compose orchestrator + Gate 4 formatter

**Files:**
- Create: `packages/cli/src/compose/index.ts`
- Create: `packages/cli/src/compose/format.ts`
- Create: `packages/cli/tests/compose/format.test.ts`

- [ ] **Step 1: Implement format + test**

`src/compose/format.ts`:

```typescript
export interface ComposeSummary {
  draft_path: string;
  segments: { id: string; mp4: string; duration_ms: number }[];
  total_duration_ms: number;
}

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatComposeMarkdown(s: ComposeSummary): string {
  const lines = [
    `# TutorialVid Compose — Gate 4 (draft preview)`,
    ``,
    `**Draft:** \`${s.draft_path}\` (480p, watermarked) · **${fmtDuration(s.total_duration_ms)}** total`,
    ``,
    `Segments:`,
  ];
  for (const seg of s.segments) {
    lines.push(`- **${seg.id}** (${fmtDuration(seg.duration_ms)}) — \`${seg.mp4}\``);
  }
  lines.push("", "Approve, mark scenes for redo, or cancel before final render.");
  return lines.join("\n");
}
```

`tests/compose/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatComposeMarkdown } from "../../src/compose/format.js";

describe("formatComposeMarkdown", () => {
  it("renders draft summary with segments + total", () => {
    const md = formatComposeMarkdown({
      draft_path: "/cache/final/draft.mp4",
      segments: [
        { id: "s01_x", mp4: "/cache/compose/s01_x/abc.mp4", duration_ms: 30000 },
        { id: "s02_y", mp4: "/cache/compose/s02_y/def.mp4", duration_ms: 22000 }
      ],
      total_duration_ms: 52000
    });
    expect(md).toMatch(/draft\.mp4/);
    expect(md).toMatch(/0:52/);
    expect(md).toMatch(/s01_x/);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/compose/index.ts`**

```typescript
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { renderSegment } from "./render.js";
import { stitchFinal } from "./stitch.js";
import { applyWatermark, downscaleTo480p } from "./ffmpeg.js";
import { wordsToSrt } from "./srt.js";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { SceneJson } from "../script/types.js";
import type { CursorTrack } from "../record/types.js";
import type { ComposeResult } from "./types.js";
import { logger } from "../logger.js";

export interface RunComposeInput {
  scenes: SceneJson[];
  cursors: Record<string, CursorTrack>;
  audioPaths: Record<string, string[]>;
  audioDurations: Record<string, number>;
  captionWords: Record<string, { word: string; start_ms: number; end_ms: number }[]>;
  rawClips: Record<string, string>;
  config: Config;
  pluginRoot: string;
  cacheRoot: string;
  appName: string;
}

export interface RunComposeOutput {
  segments: { id: string; mp4: string; duration_ms: number }[];
  draft_path: string;
  srt_path: string;
  total_duration_ms: number;
}

const here = dirname(fileURLToPath(import.meta.url));

function parseRes(s: string): { width: number; height: number } {
  const [w, h] = s.split("x").map((n) => parseInt(n, 10));
  return { width: w!, height: h! };
}

export async function runCompose(input: RunComposeInput): Promise<RunComposeOutput> {
  const finalRes = parseRes(input.config.compose.final_resolution);
  const limit = pLimit(input.config.compose.parallel_segment_renders);

  const composedSegments: ComposeResult[] = [];
  await Promise.all(input.scenes.map((scene) => limit(async () => {
    const cursor = input.cursors[scene.segment_id];
    const audio = input.audioPaths[scene.segment_id] ?? [];
    const durMs = input.audioDurations[scene.segment_id] ?? scene.target_duration_s * 1000;
    const captions = input.captionWords[scene.segment_id] ?? [];
    const rawClip = input.rawClips[scene.segment_id];
    if (!cursor || !rawClip) {
      logger.warn({ segment: scene.segment_id }, "missing cursor or raw clip; skipping");
      return;
    }
    const cursorSvg = join(input.pluginRoot, "templates", "cursor", `${scene.tone}.svg`);
    const hash = hashInputs({ segment_id: scene.segment_id, duration_ms: durMs, audio_count: audio.length });
    const outPath = join(input.cacheRoot, "compose", scene.segment_id, `${hash}.mp4`);
    await mkdir(dirname(outPath), { recursive: true });
    const r = await renderSegment({
      scene, cursor,
      audio_paths: audio,
      audio_duration_ms: durMs,
      caption_words: captions,
      raw_clip_path: rawClip,
      out_path: outPath,
      resolution: finalRes,
      fps: input.config.compose.fps,
      cursor_svg_path: cursorSvg,
      cursor_size_px: input.config.compose.cursor_size_px,
      cursor_idle_hide_ms: input.config.compose.cursor_idle_hide_ms
    });
    composedSegments.push(r);
  })));

  composedSegments.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
  const segmentMp4s = composedSegments.map((s) => s.composed_mp4_path);

  // SRT sidecar from concatenated caption words (offset per segment)
  let cursorMs = 0;
  const allWords: { word: string; start_ms: number; end_ms: number }[] = [];
  for (const seg of composedSegments) {
    const words = input.captionWords[seg.segment_id] ?? [];
    for (const w of words) allWords.push({ word: w.word, start_ms: cursorMs + w.start_ms, end_ms: cursorMs + w.end_ms });
    cursorMs += seg.duration_ms;
  }
  const srtTarget = join(input.cacheRoot, "final", "draft.srt");
  await mkdir(dirname(srtTarget), { recursive: true });
  await writeFile(srtTarget, wordsToSrt(allWords, 5), "utf8");

  // Choose music
  const musicPath = input.config.compose.music_override_path
    ? input.config.compose.music_override_path
    : join(input.pluginRoot, "templates", "music", `${input.scenes[0]?.tone ?? "friendly"}.mp3`);

  const introTemplatePath = join(input.pluginRoot, "templates", "intro", `${input.config.compose.intro_template}.json`);
  const outroTemplatePath = join(input.pluginRoot, "templates", "outro", `${input.config.compose.outro_template}.json`);

  const workDir = join(input.cacheRoot, "compose", "_stitch");
  const stitchedHd = join(workDir, "stitched-hd.mp4");
  await stitchFinal({
    segmentMp4s,
    introTemplatePath, outroTemplatePath,
    musicPath, musicVolume: input.config.compose.music_volume,
    appName: input.appName,
    ...(input.config.compose.outro_cta !== undefined ? { outroCta: input.config.compose.outro_cta } : { outroCta: undefined }),
    workDir,
    finalOut: stitchedHd,
    resolution: finalRes
  });

  // Downscale + watermark for draft preview
  const draftDir = join(input.cacheRoot, "final");
  await mkdir(draftDir, { recursive: true });
  const draftScaled = join(draftDir, "draft-no-wm.mp4");
  const draftFinal = join(draftDir, "draft.mp4");
  await downscaleTo480p(stitchedHd, draftScaled);
  await applyWatermark(draftScaled, draftFinal, input.config.compose.watermark_text);

  return {
    segments: composedSegments.map((s) => ({ id: s.segment_id, mp4: s.composed_mp4_path, duration_ms: s.duration_ms })),
    draft_path: draftFinal,
    srt_path: srtTarget,
    total_duration_ms: composedSegments.reduce((acc, s) => acc + s.duration_ms, 0)
  };
}
```

- [ ] **Step 3: Build clean + run format test + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test compose/format
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/index.ts packages/cli/src/compose/format.ts packages/cli/tests/compose/format.test.ts
git commit -m "feat(compose): orchestrator (parallel segment render + stitch + watermark draft) + Gate 4 formatter"
```

---

## Task 10: `tutorialvid compose` command

**Files:**
- Create: `packages/cli/src/commands/compose.ts`
- Modify: `packages/cli/src/index.ts` — register `compose` subcommand

- [ ] **Step 1: Implement `packages/cli/src/commands/compose.ts`**

```typescript
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

export interface ComposeCommandOpts { cwd: string; pluginRoot?: string; printMarkdown?: boolean; }

async function loadSegmentArtifacts(scriptDir: string, recordDir: string) {
  const segDirs = await readdir(scriptDir);
  const scenes: SceneJson[] = [];
  const cursors: Record<string, CursorTrack> = {};
  const audioPaths: Record<string, string[]> = {};
  const audioDurations: Record<string, number> = {};
  const captionWords: Record<string, { word: string; start_ms: number; end_ms: number }[]> = {};
  const rawClips: Record<string, string> = {};
  for (const seg of segDirs) {
    const scriptSeg = join(scriptDir, seg);
    const files = await readdir(scriptSeg);
    const sceneFile = files.find((f) => f.endsWith(".scene.json"));
    if (!sceneFile) continue;
    const scene = JSON.parse(await readFile(join(scriptSeg, sceneFile), "utf8")) as SceneJson;
    scenes.push(scene);
    const audio = files.filter((f) => f.endsWith(".mp3")).sort().map((f) => join(scriptSeg, f));
    audioPaths[seg] = audio;
    const timingFile = files.find((f) => f.endsWith(".timing.json"));
    if (timingFile) {
      const t = JSON.parse(await readFile(join(scriptSeg, timingFile), "utf8")) as { duration_ms: number; timing: { word: string; start_ms: number; end_ms: number }[] };
      audioDurations[seg] = t.duration_ms;
      captionWords[seg] = t.timing;
    }
    try {
      const recordSeg = join(recordDir, seg);
      const recFiles = await readdir(recordSeg);
      const cursorFile = recFiles.find((f) => f.endsWith(".cursor.json"));
      const mp4 = recFiles.find((f) => f.endsWith(".mp4") || f.endsWith(".webm"));
      if (cursorFile) cursors[seg] = JSON.parse(await readFile(join(recordSeg, cursorFile), "utf8"));
      if (mp4) rawClips[seg] = join(recordSeg, mp4);
    } catch {}
  }
  return { scenes, cursors, audioPaths, audioDurations, captionWords, rawClips };
}

export async function composeCommand(opts: ComposeCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try { config = await loadConfig(projectRoot); }
  catch (err) {
    logger.error({ err: (err as Error).message }, "config load failed");
    return 1;
  }
  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("compose");

  const arts = await loadSegmentArtifacts(join(paths.cache, "script"), join(paths.cache, "record"));
  const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;

  let result;
  try {
    result = await runCompose({
      scenes: arts.scenes, cursors: arts.cursors,
      audioPaths: arts.audioPaths, audioDurations: arts.audioDurations,
      captionWords: arts.captionWords, rawClips: arts.rawClips,
      config, pluginRoot, cacheRoot: paths.cache,
      appName: config.app.name
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "compose stage failed");
    return 1;
  }

  for (const seg of result.segments) {
    await sm.markSegmentStage(seg.id, "compose", "ok");
  }
  await sm.markStageComplete("compose");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatComposeMarkdown({
      draft_path: result.draft_path,
      segments: result.segments,
      total_duration_ms: result.total_duration_ms
    }) + "\n");
  }
  logger.info({ draft: result.draft_path, srt: result.srt_path }, "compose stage complete");
  return 0;
}
```

- [ ] **Step 2: Wire `compose` into `packages/cli/src/index.ts`** (after `record` command):

```typescript
program
  .command("compose")
  .description("Render per-segment Remotion compositions + stitch + watermark draft (Gate 4)")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .option("--no-markdown", "suppress Gate 4 markdown")
  .action(async (opts) => {
    const { composeCommand } = await import("./commands/compose.js");
    const code = await composeCommand({ cwd: opts.cwd, pluginRoot: opts.pluginRoot, printMarkdown: opts.markdown !== false });
    process.exit(code);
  });
```

- [ ] **Step 3: Build + run all tests**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/commands/compose.ts packages/cli/src/index.ts
git commit -m "feat(cli): add 'tutorialvid compose' command"
```

---

## Task 11: Compose E2E test (boundary checks, no real render)

**Files:**
- Create: `packages/cli/tests/e2e/compose.test.ts`

> Real Remotion render takes minutes and needs Chromium + ffmpeg actually working. The E2E test exercises the failure path (missing artifacts) only. Real-render verification lands in the manual test checklist.

- [ ] **Step 1: Create the test**

```typescript
import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliBin = resolve(__dirname, "../../bin/tutorialvid");

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: { mode: "waterfall" },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "FAKE_GEMINI", language: "en-US",
    model: "gemini-2.5-flash-tts",
    voices: { friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" },
    speed_per_tone: { friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 },
    chunk_max_chars: 800
  },
  anthropic: { api_key_env: "FAKE_ANTHROPIC", model: "claude-sonnet-4-6", max_concurrency: 2 },
  script: { depth: "medium", tone: "friendly", language: "en-US" },
  record: {
    headless: true, viewport: { width: 1920, height: 1080 },
    selector_retry: 3, selector_retry_backoff_ms: 100,
    cursor_poll_hz: 60, auth_recover: true,
    gate_3_enabled: false, max_segment_concurrency: 1
  },
  compose: {
    draft_resolution: "854x480", final_resolution: "1920x1080", fps: 30,
    watermark_text: "DRAFT", music_volume: 0.15,
    intro_template: "minimal", outro_template: "cta-link",
    cursor_size_px: 48, cursor_idle_hide_ms: 2000,
    parallel_segment_renders: 2
  }
};

describe("e2e: compose boundary", () => {
  it("compose with no artifacts logs a clean error and exits non-zero", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-compose-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    const run = await execa("node", [cliBin, "compose", "--cwd", target], { reject: false });
    expect(run.exitCode).not.toBe(0);
  }, 60_000);
});
```

- [ ] **Step 2: Build + run + commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test e2e/compose
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/tests/e2e/compose.test.ts
git commit -m "test(e2e): compose boundary check (missing artifacts → clean exit)"
```

---

## Task 12: Skill update + manual checklist + tag v0.0.4-plan4

- [ ] **Step 1: Update SKILL.md `Capability` section to v0.0.4** describing all 6 stages (scan → plan → script → tts → record → compose) and Gates 1, 2, 3, 4. Bump versions in `plugin.json` and `package.json` to 0.0.4.

- [ ] **Step 2: Append Plan 4 acceptance to `docs/manual-test-checklist.md`**

```markdown

## Plan 4 acceptance: compose + Gate 4

Prereqs: Plans 1-3 manually verified, mp3 + cursor + raw mp4 artifacts present.

- [ ] `tutorialvid compose --cwd <root>` produces `cache/compose/<segment>/<hash>.mp4` per segment.
- [ ] `cache/final/draft.mp4` exists at 854x480 with `DRAFT — TutorialVid` watermark visible top-right.
- [ ] `cache/final/draft.srt` is a valid SRT file (open in any caption tool).
- [ ] Cursor SVG matches the segment's tone (e.g. friendly = purple).
- [ ] Zoom on click is visible during the 200/600/200 ms window.
- [ ] Callouts appear at the action's t_ms and disappear after duration_ms.
- [ ] Background music is audible at ~15% volume under TTS narration.
- [ ] Intro shows `app.name`; outro shows `compose.outro_cta`.
- [ ] Setting `compose.music_override_path` swaps the music track.
- [ ] Setting `compose.music_volume: 0` removes music entirely.
- [ ] Per-segment state advances `compose` to `ok`.
```

- [ ] **Step 3: Append Plan 4 close-out to vault session log + Plan 5 starting points** (cite: full HD finalize, watermark removal, real audio duration via ffprobe, real cursor coordinates from page.mouse, telemetry, error UX polish).

- [ ] **Step 4: Commit + tag**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin docs/manual-test-checklist.md Vault/
git commit -m "docs: Plan 4 skill + checklist + vault close-out"
git tag -a v0.0.4-plan4 -m "Plan 4 complete: compose + Gate 4"
```

- [ ] **Step 5: Final verification**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && git tag -l
```

Expected: ~110 tests pass. Build clean. Four tags.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 4 covers spec §4.6 (compose stage: layers 1-6, Remotion compositor, ffmpeg muxer), §8 Gate 4 (480p draft preview with watermark). Deferred: full-HD finalize (Plan 5), watermark removal at finalize (Plan 5), real per-word timing via ffprobe (Plan 5), real cursor coordinates on click (Plan 5), polished intro/outro Remotion templates (Plan 5).

**Placeholder scan** — three explicitly-flagged simplifications:
1. Music tracks ship as 1-second silent placeholders. Plan 5 sources real CC0 tracks.
2. Intro/outro = ffmpeg drawtext title cards. Plan 5 polish replaces with Remotion-rendered animated intros.
3. Zoom centre = 50/50 default. Plan 5 derives actual centre from cursor track at click moment.

Each is explicit scope decision with named follow-up.

**Type consistency** — `SceneJson` flows scene → timeline → render → composed mp4. `CursorTrack` flows record → compose components. `SrtWord` is shared between SRT emit + caption helpers + CaptionBar component. `ComposeInput`/`Result` consistent. `Config.compose` block reads cleanly from `runCompose`.

**Architecture decisions locked**:
- Remotion 4.x + JSX in CLI package (added `jsx: react-jsx` to tsconfig).
- ffmpeg via `@ffmpeg-installer/ffmpeg` static binary + `fluent-ffmpeg` API.
- Per-segment renders parallel (Remotion bundle reused across renders); ffmpeg stitch serial.
- Bundle path cached across segments (avoid re-bundling per segment).
- Watermark applied at ffmpeg layer post-stitch for draft only; Plan 5 adds non-watermarked finalize path.
- E2E exercises only failure path (real Remotion render too slow for CI).

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-4-compose.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
