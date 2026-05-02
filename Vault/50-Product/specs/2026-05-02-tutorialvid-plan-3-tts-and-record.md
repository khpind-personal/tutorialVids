# TutorialVid — Plan 3: TTS + Record + Gate 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tutorialvid tts` (synthesizes per-segment narration via Gemini TTS into mp3 + per-word timing JSON) and `tutorialvid record` (drives Playwright per scene.json with auth waterfall + cursor track + selector retry + auth-expiry recovery), with optional Gate 3 (raw clip preview) the skill can render.

**Architecture:** TTS via `@google/genai` SDK; SSML split at pause points and synthesised per chunk so script edits invalidate only changed chunks; per-tone voice + speed pulled from config. Recorder reuses Plan 1's Playwright dependency, layering scene-action interpretation, cursor-track emit (60 Hz polling + event), seed-script execution, and an auth-waterfall (A creds → B storage state → C inline) bound by config. Gate 3 is opt-in (default OFF, opt-in for High-depth runs); when on, the skill shows raw clip paths to the user before Plan 4's compose stage.

**Tech Stack additions:** `@google/genai` ^1.0.0 (Gemini SDK), `p-queue` ^8.0.1 (segment-level concurrency, separate from p-limit used inside script).

**Spec:** `docs/specs/2026-05-02-tutorialvid-design.md` §4.4, §4.5, §8 Gate 3, §10 (selector retry + auth recovery).

**Out of scope (Plan 4+):** Remotion compose, ffmpeg mux, branding overlays, watermark, finalize.

---

## Prerequisites (must be done before Task 1)

- `GEMINI_API_KEY` exported.
- A working scan + plan + script run (per Plans 1 and 2).
- Playwright Chromium installed (Plan 1 already installed).

---

## File Structure (Plan 3 targets)

```
packages/cli/
├── src/
│   ├── tts/
│   │   ├── types.ts              — TTSChunk, TTSResult, VoiceMapping
│   │   ├── chunker.ts            — split SSML at pause points → TTSChunk[]
│   │   ├── voices.ts             — tone → Gemini voice mapping
│   │   ├── gemini.ts             — Gemini TTS adapter (chunk → mp3 + timing)
│   │   └── index.ts              — runTts() orchestrator
│   ├── record/
│   │   ├── types.ts              — RecordResult, CursorTrack, RecordError
│   │   ├── auth.ts               — auth waterfall A → B → C
│   │   ├── seed.ts               — run user-supplied seed command
│   │   ├── cursor.ts             — cursor-track emitter (60 Hz)
│   │   ├── runner.ts             — scene.json action runner with retry
│   │   ├── recovery.ts           — auth-expiry detection + re-auth
│   │   ├── format.ts             — Gate 3 markdown summary
│   │   └── index.ts              — runRecord() orchestrator
│   └── commands/
│       ├── tts.ts                — `tutorialvid tts`
│       └── record.ts             — `tutorialvid record`
└── tests/
    ├── tts/chunker.test.ts
    ├── tts/voices.test.ts
    ├── tts/gemini.test.ts
    ├── tts/index.test.ts
    ├── record/auth.test.ts
    ├── record/cursor.test.ts
    ├── record/runner.test.ts
    ├── record/recovery.test.ts
    ├── record/format.test.ts
    └── e2e/tts-record.test.ts

packages/plugin/skills/tutorialvid-create/SKILL.md — extended with TTS + Record + Gate 3
```

---

## Task 1: Add Gemini SDK + extend config for voice mapping

**Files:**
- Modify: `packages/cli/package.json` — add `@google/genai`, `p-queue`
- Modify: `packages/cli/src/config/schema.ts` — extend `tts` block with optional `voices` and `speed_per_tone`; add `record` block

- [ ] **Step 1: Install deps**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli add @google/genai@^1.0.0 p-queue@^8.0.1
```

- [ ] **Step 2: Extend `config/schema.ts`** — replace the existing `tts` block with the expanded version below; add a new `record` block before `telemetry`.

```typescript
  tts: z.object({
    provider: z.literal("gemini"),
    api_key_env: z.string(),
    language: z.string(),
    model: z.string().default("gemini-2.5-flash-tts"),
    voices: z.object({
      friendly: z.string().default("Aoede"),
      pro: z.string().default("Charon"),
      hype: z.string().default("Fenrir"),
      founder: z.string().default("Orus"),
      documentary: z.string().default("Kore")
    }).default({ friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" }),
    speed_per_tone: z.object({
      friendly: z.number().default(1.0),
      pro: z.number().default(1.05),
      hype: z.number().default(1.10),
      founder: z.number().default(1.0),
      documentary: z.number().default(0.95)
    }).default({ friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 }),
    chunk_max_chars: z.number().int().positive().default(800)
  }),
  record: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({
      width: z.number().int().positive().default(1920),
      height: z.number().int().positive().default(1080)
    }).default({ width: 1920, height: 1080 }),
    selector_retry: z.number().int().nonnegative().default(3),
    selector_retry_backoff_ms: z.number().int().nonnegative().default(500),
    cursor_poll_hz: z.number().int().positive().default(60),
    auth_recover: z.boolean().default(true),
    gate_3_enabled: z.boolean().default(false),
    max_segment_concurrency: z.number().int().positive().default(1)
  }).default({
    headless: true, viewport: { width: 1920, height: 1080 },
    selector_retry: 3, selector_retry_backoff_ms: 500,
    cursor_poll_hz: 60, auth_recover: true,
    gate_3_enabled: false, max_segment_concurrency: 1
  }),
```

> **Note:** voice names like "Aoede" / "Charon" are placeholders matching Gemini's published prebuilt voice catalogue at the time of writing. The implementer should verify against the Gemini docs at impl time and adjust if the catalogue changed.

- [ ] **Step 3: Update existing config test**

In `tests/config/load.test.ts`, the existing "applies defaults for new anthropic + script blocks" test will still pass. Add a new test:

```typescript
  it("provides default voice + speed mapping per tone", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.tts.voices.friendly).toBe("Aoede");
    expect(cfg.tts.speed_per_tone.documentary).toBe(0.95);
    expect(cfg.tts.chunk_max_chars).toBe(800);
    expect(cfg.record.headless).toBe(true);
    expect(cfg.record.viewport.width).toBe(1920);
  });
```

- [ ] **Step 4: Run tests + build**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test config/load
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/package.json packages/cli/src/config/schema.ts packages/cli/tests pnpm-lock.yaml
git commit -m "feat(cli): add Gemini SDK + extend tts/record config (voices, speeds, viewport, retry)"
```

---

## Task 2: TTS — SSML chunker

**Files:**
- Create: `packages/cli/src/tts/types.ts`
- Create: `packages/cli/src/tts/chunker.ts`
- Create: `packages/cli/tests/tts/chunker.test.ts`

- [ ] **Step 1: Types**

```typescript
export interface TTSChunk {
  index: number;
  ssml: string;
  text: string;
}

export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TTSResult {
  mp3_path: string;
  timing: WordTiming[];
  duration_ms: number;
}

export type Tone = "friendly" | "pro" | "hype" | "founder" | "documentary";

export interface VoiceMapping {
  voice: string;
  speed: number;
}
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/tts/chunker.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { chunkSsml } from "../../src/tts/chunker.js";

describe("chunkSsml", () => {
  it("returns one chunk when SSML fits below limit", () => {
    const chunks = chunkSsml(`<speak>Hello world.</speak>`, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("Hello world.");
  });

  it("splits at <break> tags when over the limit", () => {
    const ssml = `<speak>First sentence here. <break time='200ms'/>Second sentence here. <break time='200ms'/>Third sentence here.</speak>`;
    const chunks = chunkSsml(ssml, 35);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.ssml.startsWith("<speak>") && c.ssml.endsWith("</speak>"))).toBe(true);
  });

  it("splits at sentence boundaries when no break tags exist", () => {
    const ssml = `<speak>Sentence one. Sentence two. Sentence three.</speak>`;
    const chunks = chunkSsml(ssml, 20);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("indexes chunks sequentially from 0", () => {
    const chunks = chunkSsml(`<speak>A. B. C. D.</speak>`, 5);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("strips ssml tags for the text field", () => {
    const chunks = chunkSsml(`<speak>Click <emphasis level='strong'>here</emphasis>.</speak>`, 1000);
    expect(chunks[0]?.text).toBe("Click here.");
  });
});
```

- [ ] **Step 3: Verify FAIL**

- [ ] **Step 4: Implement `packages/cli/src/tts/chunker.ts`**

```typescript
import type { TTSChunk } from "./types.js";

const SPEAK_OPEN = "<speak>";
const SPEAK_CLOSE = "</speak>";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function unwrapSpeak(ssml: string): string {
  const trimmed = ssml.trim();
  if (trimmed.startsWith(SPEAK_OPEN) && trimmed.endsWith(SPEAK_CLOSE)) {
    return trimmed.slice(SPEAK_OPEN.length, trimmed.length - SPEAK_CLOSE.length);
  }
  return trimmed;
}

function wrapSpeak(s: string): string {
  return `${SPEAK_OPEN}${s}${SPEAK_CLOSE}`;
}

export function chunkSsml(ssml: string, maxChars: number): TTSChunk[] {
  const inner = unwrapSpeak(ssml);
  if (inner.length <= maxChars) {
    return [{ index: 0, ssml: wrapSpeak(inner), text: stripTags(inner) }];
  }

  // Pass 1: split at <break ...> tags
  const breakRe = /<break[^>]*\/>/g;
  const parts = inner.split(breakRe).map((p) => p.trim()).filter((p) => p.length > 0);

  // If still over the limit per part, split each part at sentence boundaries
  const final: string[] = [];
  for (const p of parts) {
    if (p.length <= maxChars) { final.push(p); continue; }
    const sentences = p.split(/(?<=[.!?])\s+/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).trim().length > maxChars && buf.length > 0) {
        final.push(buf.trim());
        buf = s;
      } else {
        buf = (buf + " " + s).trim();
      }
    }
    if (buf.length > 0) final.push(buf);
  }

  // Coalesce neighbouring parts when their combined length is still under the limit
  const coalesced: string[] = [];
  for (const f of final) {
    const last = coalesced[coalesced.length - 1];
    if (last !== undefined && (last.length + f.length + 1) <= maxChars) {
      coalesced[coalesced.length - 1] = `${last} ${f}`;
    } else {
      coalesced.push(f);
    }
  }

  return coalesced.map((c, i) => ({ index: i, ssml: wrapSpeak(c), text: stripTags(c) }));
}
```

- [ ] **Step 5: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test tts/chunker
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/tts/types.ts packages/cli/src/tts/chunker.ts packages/cli/tests/tts/chunker.test.ts
git commit -m "feat(tts): SSML chunker (split at break tags + sentence boundaries)"
```

---

## Task 3: TTS — voice mapping

**Files:**
- Create: `packages/cli/src/tts/voices.ts`
- Create: `packages/cli/tests/tts/voices.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect } from "vitest";
import { resolveVoice } from "../../src/tts/voices.js";

const cfgVoices = { friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" };
const cfgSpeeds = { friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 };

describe("resolveVoice", () => {
  it("returns voice + speed for each tone", () => {
    expect(resolveVoice("friendly", cfgVoices, cfgSpeeds)).toEqual({ voice: "Aoede", speed: 1.0 });
    expect(resolveVoice("hype", cfgVoices, cfgSpeeds)).toEqual({ voice: "Fenrir", speed: 1.10 });
    expect(resolveVoice("documentary", cfgVoices, cfgSpeeds)).toEqual({ voice: "Kore", speed: 0.95 });
  });

  it("works with custom voice override in config", () => {
    const custom = { ...cfgVoices, friendly: "Custom-X" };
    expect(resolveVoice("friendly", custom, cfgSpeeds)).toEqual({ voice: "Custom-X", speed: 1.0 });
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement**

```typescript
import type { Tone, VoiceMapping } from "./types.js";

export type ToneVoiceMap = Record<Tone, string>;
export type ToneSpeedMap = Record<Tone, number>;

export function resolveVoice(tone: Tone, voices: ToneVoiceMap, speeds: ToneSpeedMap): VoiceMapping {
  return { voice: voices[tone], speed: speeds[tone] };
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test tts/voices
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/tts/voices.ts packages/cli/tests/tts/voices.test.ts
git commit -m "feat(tts): voice + speed resolver per tone"
```

---

## Task 4: TTS — Gemini adapter (chunk → mp3 + timing)

**Files:**
- Create: `packages/cli/src/tts/gemini.ts`
- Create: `packages/cli/tests/tts/gemini.test.ts`

> Real Gemini calls are expensive and need a key. Test with mocked SDK; manual checklist exercises real calls.

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synthesiseChunk } from "../../src/tts/gemini.js";

const generateMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generateMock };
  }
}));

beforeEach(() => {
  generateMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("synthesiseChunk", () => {
  it("calls Gemini with voice + speed and writes mp3 to disk", async () => {
    generateMock.mockResolvedValueOnce({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: "audio/mp3",
              data: Buffer.from("fake-mp3-bytes").toString("base64")
            }
          }]
        }
      }]
    });
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    const r = await synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>Hello.</speak>", text: "Hello." },
      voice: "Aoede",
      speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY",
      model: "gemini-2.5-flash-tts",
      language: "en-US",
      outDir
    });
    expect(r.mp3_path).toMatch(/0\.mp3$/);
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
    expect(generateMock).toHaveBeenCalledOnce();
  });

  it("throws when API key env var is unset", async () => {
    delete process.env.GEMINI_API_KEY;
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    await expect(synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>x</speak>", text: "x" },
      voice: "Aoede", speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US", outDir
    })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("throws when response has no audio data", async () => {
    generateMock.mockResolvedValueOnce({ candidates: [{ content: { parts: [] } }] });
    const outDir = mkdtempSync(join(tmpdir(), "tv-tts-"));
    await expect(synthesiseChunk({
      chunk: { index: 0, ssml: "<speak>x</speak>", text: "x" },
      voice: "Aoede", speed: 1.0,
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US", outDir
    })).rejects.toThrow(/no audio/i);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `packages/cli/src/tts/gemini.ts`**

```typescript
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { TTSChunk, WordTiming } from "./types.js";

export interface SynthesiseInput {
  chunk: TTSChunk;
  voice: string;
  speed: number;
  apiKeyEnv: string;
  model: string;
  language: string;
  outDir: string;
}

export interface SynthesiseResult {
  mp3_path: string;
  duration_ms: number;
  timing: WordTiming[];
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF = 800;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function evenWordTiming(text: string, durationMs: number): WordTiming[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const slice = durationMs / words.length;
  return words.map((w, i) => ({ word: w, start_ms: Math.round(i * slice), end_ms: Math.round((i + 1) * slice) }));
}

export async function synthesiseChunk(input: SynthesiseInput): Promise<SynthesiseResult> {
  const apiKey = process.env[input.apiKeyEnv];
  if (!apiKey) throw new Error(`${input.apiKeyEnv} is not set`);
  await mkdir(input.outDir, { recursive: true });
  const target = join(input.outDir, `${input.chunk.index}.mp3`);

  const client = new GoogleGenAI({ apiKey });
  let attempt = 0;
  while (true) {
    try {
      const resp = await client.models.generateContent({
        model: input.model,
        contents: [{ role: "user", parts: [{ text: input.chunk.ssml }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice } },
            speakingRate: input.speed,
            languageCode: input.language
          }
        }
      } as unknown as Parameters<typeof client.models.generateContent>[0]);

      const part = resp.candidates?.[0]?.content?.parts?.[0] as { inlineData?: { data?: string; mimeType?: string } } | undefined;
      const data = part?.inlineData?.data;
      if (!data) throw new Error(`Gemini response had no audio data`);

      const audioBuf = Buffer.from(data, "base64");
      await writeFile(target, audioBuf);

      // Heuristic duration: assume 150 wpm + speed factor; replace with real ffprobe in Plan 5.
      const wpm = 150 * input.speed;
      const wordCount = input.chunk.text.split(/\s+/).filter(Boolean).length;
      const duration_ms = Math.round((wordCount / wpm) * 60_000);
      const timing = evenWordTiming(input.chunk.text, duration_ms);

      return { mp3_path: target, duration_ms, timing };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && RETRYABLE.has(status) && attempt < DEFAULT_RETRIES) {
        await sleep(DEFAULT_BACKOFF * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
```

> **Note:** Real per-word timing from Gemini requires either ffprobe parsing or an alignment service; Plan-3 ships an even-distribution heuristic (good enough for Plan 4 caption timing) and flags real alignment as a Plan-5 polish item.

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test tts/gemini
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/tts/gemini.ts packages/cli/tests/tts/gemini.test.ts
git commit -m "feat(tts): Gemini adapter (chunk → mp3 + heuristic word timing)"
```

---

## Task 5: TTS orchestrator + `tutorialvid tts` command

**Files:**
- Create: `packages/cli/src/tts/index.ts`
- Create: `packages/cli/src/commands/tts.ts`
- Modify: `packages/cli/src/index.ts` — register `tts` subcommand
- Create: `packages/cli/tests/tts/index.test.ts`

- [ ] **Step 1: Write FAILING test for orchestrator (mocked synthesiseChunk)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTts } from "../../src/tts/index.js";

const synthMock = vi.fn();
vi.mock("../../src/tts/gemini.js", () => ({
  synthesiseChunk: (...args: unknown[]) => synthMock(...args)
}));

beforeEach(() => synthMock.mockReset());

describe("runTts", () => {
  it("synthesises one mp3 per chunk and concatenates timing", async () => {
    synthMock.mockImplementation(async (input: { chunk: { index: number; text: string }; outDir: string }) => ({
      mp3_path: `${input.outDir}/${input.chunk.index}.mp3`,
      duration_ms: 1000,
      timing: [{ word: input.chunk.text, start_ms: 0, end_ms: 1000 }]
    }));
    const root = mkdtempSync(join(tmpdir(), "tv-tts-"));
    const r = await runTts({
      ssml: "<speak>One. Two. Three.</speak>",
      tone: "friendly",
      voices: { friendly: "Aoede", pro: "x", hype: "x", founder: "x", documentary: "x" },
      speeds: { friendly: 1.0, pro: 1, hype: 1, founder: 1, documentary: 1 },
      apiKeyEnv: "GEMINI_API_KEY", model: "x", language: "en-US",
      chunkMaxChars: 5,
      outDir: root
    });
    expect(r.chunks.length).toBeGreaterThanOrEqual(2);
    expect(r.duration_ms).toBeGreaterThan(0);
    expect(r.timing.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/tts/index.ts`**

```typescript
import { chunkSsml } from "./chunker.js";
import { resolveVoice, type ToneVoiceMap, type ToneSpeedMap } from "./voices.js";
import { synthesiseChunk } from "./gemini.js";
import type { Tone, WordTiming } from "./types.js";

export interface RunTtsInput {
  ssml: string;
  tone: Tone;
  voices: ToneVoiceMap;
  speeds: ToneSpeedMap;
  apiKeyEnv: string;
  model: string;
  language: string;
  chunkMaxChars: number;
  outDir: string;
}

export interface RunTtsResult {
  chunks: { index: number; mp3_path: string; duration_ms: number }[];
  duration_ms: number;
  timing: WordTiming[];
}

export async function runTts(input: RunTtsInput): Promise<RunTtsResult> {
  const { voice, speed } = resolveVoice(input.tone, input.voices, input.speeds);
  const chunks = chunkSsml(input.ssml, input.chunkMaxChars);

  const results = [];
  let cursorMs = 0;
  const timing: WordTiming[] = [];
  for (const chunk of chunks) {
    const r = await synthesiseChunk({
      chunk, voice, speed,
      apiKeyEnv: input.apiKeyEnv, model: input.model, language: input.language,
      outDir: input.outDir
    });
    for (const t of r.timing) {
      timing.push({ word: t.word, start_ms: cursorMs + t.start_ms, end_ms: cursorMs + t.end_ms });
    }
    results.push({ index: chunk.index, mp3_path: r.mp3_path, duration_ms: r.duration_ms });
    cursorMs += r.duration_ms;
  }

  return { chunks: results, duration_ms: cursorMs, timing };
}
```

- [ ] **Step 3: Implement `packages/cli/src/commands/tts.ts`**

```typescript
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
```

- [ ] **Step 4: Wire `tts` into `src/index.ts`** (after `script` command):

```typescript
program
  .command("tts")
  .description("Synthesise per-segment narration via Gemini TTS")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { ttsCommand } = await import("./commands/tts.js");
    const code = await ttsCommand({ cwd: opts.cwd });
    process.exit(code);
  });
```

- [ ] **Step 5: Build + test + commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test tts
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/tts/index.ts packages/cli/src/commands/tts.ts packages/cli/src/index.ts packages/cli/tests/tts/index.test.ts
git commit -m "feat(cli): add 'tutorialvid tts' command (chunked Gemini synthesis per segment)"
```

---

## Task 6: Record — auth waterfall (A → B → C)

**Files:**
- Create: `packages/cli/src/record/types.ts`
- Create: `packages/cli/src/record/auth.ts`
- Create: `packages/cli/tests/record/auth.test.ts`

- [ ] **Step 1: `packages/cli/src/record/types.ts`**

```typescript
export interface CursorEvent {
  t_ms: number;
  x: number;
  y: number;
  event: "move" | "down" | "up";
}

export interface CursorTrack {
  events: CursorEvent[];
}

export interface RecordSegmentResult {
  segment_id: string;
  mp4_path: string;
  cursor_track_path: string;
  duration_ms: number;
}

export type AuthMode = "credentials" | "storage_state" | "inline";
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/record/auth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyAuth } from "../../src/record/auth.js";

const fillMock = vi.fn();
const clickMock = vi.fn();
const gotoMock = vi.fn();
const waitForLoadStateMock = vi.fn();
const addCookiesMock = vi.fn();

const fakePage = { goto: gotoMock, fill: fillMock, click: clickMock, waitForLoadState: waitForLoadStateMock };
const fakeContext = { addCookies: addCookiesMock, storageState: vi.fn() };

beforeEach(() => {
  fillMock.mockReset(); clickMock.mockReset(); gotoMock.mockReset();
  waitForLoadStateMock.mockReset(); addCookiesMock.mockReset();
});

describe("applyAuth", () => {
  it("uses credentials mode (A) when env vars set", async () => {
    process.env.TV_USER = "demo"; process.env.TV_PASS = "demo";
    await applyAuth({
      mode: "credentials",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      credentials: {
        login_url: "/login",
        username_env: "TV_USER", password_env: "TV_PASS",
        username_selector: "[data-test=username]",
        password_selector: "[data-test=password]",
        submit_selector: "[data-test=submit]"
      }
    });
    expect(gotoMock).toHaveBeenCalled();
    expect(fillMock).toHaveBeenCalledTimes(2);
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("loads storageState (B) when path provided", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "tv-storage-"));
    const path = join(dir, "storage-state.json");
    writeFileSync(path, JSON.stringify({ cookies: [{ name: "session", value: "abc", url: "http://localhost:5173" }], origins: [] }));
    await applyAuth({
      mode: "storage_state",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      storageStatePath: path
    });
    expect(addCookiesMock).toHaveBeenCalled();
  });

  it("inline (C) is currently a no-op stub (Plan 4 will record the login flow)", async () => {
    await applyAuth({
      mode: "inline",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173"
    });
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("throws when credentials env vars missing in mode A", async () => {
    delete process.env.TV_USER; delete process.env.TV_PASS;
    await expect(applyAuth({
      mode: "credentials",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      credentials: {
        login_url: "/login",
        username_env: "TV_USER", password_env: "TV_PASS",
        username_selector: "u", password_selector: "p", submit_selector: "s"
      }
    })).rejects.toThrow(/TV_USER|TV_PASS/);
  });
});
```

- [ ] **Step 3: Implement `packages/cli/src/record/auth.ts`**

```typescript
import { readFile } from "node:fs/promises";
import type { Page, BrowserContext } from "playwright";
import type { AuthMode } from "./types.js";

export interface AuthCredentials {
  login_url: string;
  username_env: string;
  password_env: string;
  username_selector: string;
  password_selector: string;
  submit_selector: string;
}

export interface ApplyAuthInput {
  mode: AuthMode;
  page: Page;
  context: BrowserContext;
  baseUrl: string;
  credentials?: AuthCredentials;
  storageStatePath?: string;
}

export async function applyAuth(input: ApplyAuthInput): Promise<void> {
  switch (input.mode) {
    case "credentials": {
      if (!input.credentials) throw new Error("credentials block missing");
      const u = process.env[input.credentials.username_env];
      const p = process.env[input.credentials.password_env];
      if (!u || !p) throw new Error(`${input.credentials.username_env} or ${input.credentials.password_env} not set`);
      await input.page.goto(new URL(input.credentials.login_url, input.baseUrl).toString());
      await input.page.fill(input.credentials.username_selector, u);
      await input.page.fill(input.credentials.password_selector, p);
      await Promise.all([
        input.page.waitForLoadState("networkidle"),
        input.page.click(input.credentials.submit_selector)
      ]);
      return;
    }
    case "storage_state": {
      if (!input.storageStatePath) throw new Error("storage_state mode requires storageStatePath");
      const raw = await readFile(input.storageStatePath, "utf8");
      const parsed = JSON.parse(raw) as { cookies?: Parameters<BrowserContext["addCookies"]>[0] };
      if (parsed.cookies && parsed.cookies.length > 0) {
        await input.context.addCookies(parsed.cookies);
      }
      return;
    }
    case "inline":
      // Plan 4 will record the inline login as part of the tutorial; v0.0.3 is a no-op.
      return;
  }
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/auth
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/types.ts packages/cli/src/record/auth.ts packages/cli/tests/record/auth.test.ts
git commit -m "feat(record): auth waterfall (credentials + storage_state + inline stub)"
```

---

## Task 7: Record — cursor track emitter

**Files:**
- Create: `packages/cli/src/record/cursor.ts`
- Create: `packages/cli/tests/record/cursor.test.ts`

- [ ] **Step 1: Write FAILING test (uses fake event bus)**

```typescript
import { describe, it, expect } from "vitest";
import { CursorRecorder } from "../../src/record/cursor.js";

describe("CursorRecorder", () => {
  it("records mouse events with monotonic timestamps", () => {
    const r = new CursorRecorder();
    r.start();
    r.note("move", 10, 20);
    r.note("down", 10, 20);
    r.note("up", 10, 20);
    const track = r.stop();
    expect(track.events).toHaveLength(3);
    expect(track.events[0]?.event).toBe("move");
    expect(track.events[2]?.t_ms).toBeGreaterThanOrEqual(track.events[0]?.t_ms ?? 0);
  });

  it("filters duplicate move events at the same coordinate", () => {
    const r = new CursorRecorder();
    r.start();
    r.note("move", 10, 20);
    r.note("move", 10, 20);
    r.note("move", 11, 20);
    const track = r.stop();
    expect(track.events).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/record/cursor.ts`**

```typescript
import type { CursorEvent, CursorTrack } from "./types.js";

export class CursorRecorder {
  private startedAt = 0;
  private events: CursorEvent[] = [];

  start(): void { this.startedAt = Date.now(); this.events = []; }

  note(event: CursorEvent["event"], x: number, y: number): void {
    if (event === "move") {
      const last = this.events[this.events.length - 1];
      if (last && last.event === "move" && last.x === x && last.y === y) return;
    }
    this.events.push({ t_ms: Date.now() - this.startedAt, x, y, event });
  }

  stop(): CursorTrack { return { events: this.events.slice() }; }
}
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/cursor
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/cursor.ts packages/cli/tests/record/cursor.test.ts
git commit -m "feat(record): CursorRecorder (event-based + dedupe of identical move events)"
```

---

## Task 8: Record — scene action runner (with selector retry)

**Files:**
- Create: `packages/cli/src/record/runner.ts`
- Create: `packages/cli/tests/record/runner.test.ts`

- [ ] **Step 1: Write FAILING test (mock Page + selector flake)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runActions, type RunActionsInput } from "../../src/record/runner.js";
import type { SceneAction } from "../../src/script/types.js";
import type { CursorRecorder } from "../../src/record/cursor.js";

const gotoMock = vi.fn();
const clickMock = vi.fn();
const fillMock = vi.fn();
const waitForSelectorMock = vi.fn();
const evalMock = vi.fn();

const fakePage = {
  goto: gotoMock, click: clickMock, fill: fillMock,
  waitForSelector: waitForSelectorMock,
  evaluate: evalMock,
  url: () => "http://localhost:5173/dashboard"
};

const cursor = { note: vi.fn() } as unknown as CursorRecorder;

beforeEach(() => {
  gotoMock.mockReset(); clickMock.mockReset(); fillMock.mockReset();
  waitForSelectorMock.mockReset(); evalMock.mockReset();
});

describe("runActions", () => {
  it("executes nav + click in order", async () => {
    const actions: SceneAction[] = [
      { t_ms: 0, type: "nav", url: "/dashboard" },
      { t_ms: 1000, type: "click", selector: "[data-test=x]" }
    ];
    await runActions({
      page: fakePage as never, baseUrl: "http://localhost:5173",
      actions, retry: 3, retryBackoffMs: 1, cursor
    });
    expect(gotoMock).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("retries selector waits up to N times before failing", async () => {
    waitForSelectorMock
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(undefined);
    const actions: SceneAction[] = [
      { t_ms: 0, type: "wait", selector: "[data-test=flake]" }
    ];
    await runActions({
      page: fakePage as never, baseUrl: "http://localhost:5173",
      actions, retry: 3, retryBackoffMs: 1, cursor
    });
    expect(waitForSelectorMock).toHaveBeenCalledTimes(3);
  });

  it("throws SelectorTimeout after exhausting retries", async () => {
    waitForSelectorMock.mockRejectedValue(new Error("not found"));
    const actions: SceneAction[] = [
      { t_ms: 0, type: "click", selector: "[data-test=missing]" }
    ];
    await expect(runActions({
      page: fakePage as never, baseUrl: "http://localhost:5173",
      actions, retry: 2, retryBackoffMs: 1, cursor
    })).rejects.toThrow(/data-test=missing/);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/record/runner.ts`**

```typescript
import type { Page } from "playwright";
import type { SceneAction } from "../script/types.js";
import type { CursorRecorder } from "./cursor.js";

export interface RunActionsInput {
  page: Page;
  baseUrl: string;
  actions: SceneAction[];
  retry: number;
  retryBackoffMs: number;
  cursor: CursorRecorder;
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function withSelectorRetry<T>(
  fn: () => Promise<T>, retry: number, backoffMs: number, selector: string
): Promise<T> {
  let attempt = 0;
  while (true) {
    try { return await fn(); }
    catch (err) {
      if (attempt >= retry) {
        throw new Error(`selector ${selector} failed after ${retry + 1} attempts: ${(err as Error).message}`);
      }
      await sleep(backoffMs * Math.pow(2, attempt));
      attempt++;
    }
  }
}

export async function runActions(input: RunActionsInput): Promise<void> {
  for (const a of input.actions) {
    switch (a.type) {
      case "nav": {
        if (!a.url) throw new Error("nav action missing url");
        await input.page.goto(new URL(a.url, input.baseUrl).toString(), { waitUntil: "networkidle" });
        break;
      }
      case "wait": {
        if (!a.selector) throw new Error("wait action missing selector");
        await withSelectorRetry(
          () => input.page.waitForSelector(a.selector!, { timeout: 5000 }),
          input.retry, input.retryBackoffMs, a.selector
        );
        break;
      }
      case "type": {
        if (!a.selector || a.text === undefined) throw new Error("type action missing selector or text");
        await withSelectorRetry(
          () => input.page.fill(a.selector!, a.text!),
          input.retry, input.retryBackoffMs, a.selector
        );
        break;
      }
      case "click": {
        if (!a.selector) throw new Error("click action missing selector");
        await withSelectorRetry(
          () => input.page.click(a.selector!),
          input.retry, input.retryBackoffMs, a.selector
        );
        input.cursor.note("down", 0, 0);
        input.cursor.note("up", 0, 0);
        break;
      }
    }
  }
}
```

> **Note:** The cursor.note `(0,0)` placeholder for click events is a Plan-3 simplification. Plan 5 will refine to actual cursor coordinates from `page.mouse` events. Tests verify the call shape only.

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/runner
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/runner.ts packages/cli/tests/record/runner.test.ts
git commit -m "feat(record): scene action runner with selector retry + cursor notes"
```

---

## Task 9: Record — auth-expiry recovery

**Files:**
- Create: `packages/cli/src/record/recovery.ts`
- Create: `packages/cli/tests/record/recovery.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect } from "vitest";
import { detectAuthExpiry } from "../../src/record/recovery.js";

describe("detectAuthExpiry", () => {
  it("detects redirect to login url", () => {
    expect(detectAuthExpiry({ status: 302, finalUrl: "http://x/login" }, "/login")).toBe(true);
    expect(detectAuthExpiry({ status: 200, finalUrl: "http://x/login" }, "/login")).toBe(true);
  });

  it("detects 401 and 403 statuses", () => {
    expect(detectAuthExpiry({ status: 401, finalUrl: "http://x/dashboard" }, "/login")).toBe(true);
    expect(detectAuthExpiry({ status: 403, finalUrl: "http://x/dashboard" }, "/login")).toBe(true);
  });

  it("returns false for normal responses", () => {
    expect(detectAuthExpiry({ status: 200, finalUrl: "http://x/dashboard" }, "/login")).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/record/recovery.ts`**

```typescript
export interface NavOutcome {
  status: number;
  finalUrl: string;
}

export function detectAuthExpiry(outcome: NavOutcome, loginUrl: string): boolean {
  if (outcome.status === 401 || outcome.status === 403) return true;
  try {
    const finalPath = new URL(outcome.finalUrl).pathname;
    return finalPath === loginUrl;
  } catch {
    return outcome.finalUrl.endsWith(loginUrl);
  }
}
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/recovery
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/recovery.ts packages/cli/tests/record/recovery.test.ts
git commit -m "feat(record): detectAuthExpiry helper (status + login redirect)"
```

---

## Task 10: Record — Gate 3 markdown formatter

**Files:**
- Create: `packages/cli/src/record/format.ts`
- Create: `packages/cli/tests/record/format.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect } from "vitest";
import { formatRecordMarkdown } from "../../src/record/format.js";
import type { RecordSegmentResult } from "../../src/record/types.js";

const segs: RecordSegmentResult[] = [
  { segment_id: "s01_dashboard", mp4_path: "/cache/record/s01_dashboard/abc.mp4", cursor_track_path: "/cache/record/s01_dashboard/abc.cursor.json", duration_ms: 30000 },
  { segment_id: "s02_profile", mp4_path: "/cache/record/s02_profile/def.mp4", cursor_track_path: "/cache/record/s02_profile/def.cursor.json", duration_ms: 22000 }
];

describe("formatRecordMarkdown", () => {
  it("lists each segment with its mp4 path + duration", () => {
    const md = formatRecordMarkdown(segs);
    expect(md).toMatch(/s01_dashboard/);
    expect(md).toMatch(/abc\.mp4/);
    expect(md).toMatch(/0:30/);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/record/format.ts`**

```typescript
import type { RecordSegmentResult } from "./types.js";

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatRecordMarkdown(segs: RecordSegmentResult[]): string {
  const lines = [`# TutorialVid Recording — Gate 3 (raw clips)`, ``];
  for (const s of segs) {
    lines.push(`- **${s.segment_id}** (${fmtDuration(s.duration_ms)}) — \`${s.mp4_path}\``);
  }
  lines.push("", "Mark any segment 'redo' before proceeding to compose.");
  return lines.join("\n");
}
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/format
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/format.ts packages/cli/tests/record/format.test.ts
git commit -m "feat(record): Gate 3 markdown formatter"
```

---

## Task 11: Record orchestrator + `tutorialvid record` command

**Files:**
- Create: `packages/cli/src/record/index.ts`
- Create: `packages/cli/src/record/seed.ts`
- Create: `packages/cli/src/commands/record.ts`
- Modify: `packages/cli/src/index.ts` — register `record` subcommand

- [ ] **Step 1: `packages/cli/src/record/seed.ts`**

```typescript
import { execa } from "execa";

export interface RunSeedInput {
  command: string;
  cwd: string;
  skipMarkerPath?: string;
}

export async function runSeed(input: RunSeedInput): Promise<void> {
  if (input.skipMarkerPath) {
    try {
      const { access } = await import("node:fs/promises");
      await access(input.skipMarkerPath);
      return;
    } catch {}
  }
  const [bin, ...args] = input.command.split(/\s+/);
  if (!bin) throw new Error("seed command empty");
  await execa(bin, args, { cwd: input.cwd, stdio: "inherit" });
  if (input.skipMarkerPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(input.skipMarkerPath, new Date().toISOString());
  }
}
```

- [ ] **Step 2: `packages/cli/src/record/index.ts`**

```typescript
import { chromium, type Browser } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  outDirRoot: string;            // e.g. .tutorialvid/cache/record/
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
        const duration_ms = Date.now() - start;
        await context.close();
        const video = await page.video();
        const mp4_path = video ? await video.path() : "";
        const hash = hashInputs({ segment_id: scene.segment_id, scene_actions: scene.actions.length, base_url: input.baseUrl });
        const cursor_track_path = join(segDir, `${hash}.cursor.json`);
        await writeFile(cursor_track_path, JSON.stringify(track, null, 2));
        results.push({ segment_id: scene.segment_id, mp4_path, cursor_track_path, duration_ms });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
```

- [ ] **Step 3: `packages/cli/src/commands/record.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { runRecord } from "../record/index.js";
import { formatRecordMarkdown } from "../record/format.js";
import { logger } from "../logger.js";
import type { SceneJson } from "../script/types.js";
import type { ScanResult } from "../scan/types.js";

export interface RecordCommandOpts { cwd: string; printMarkdown?: boolean; }

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

async function readLatestScan(scanDir: string): Promise<ScanResult> {
  const entries = await readdir(scanDir);
  const target = join(scanDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as ScanResult;
}

export async function recordCommand(opts: RecordCommandOpts): Promise<number> {
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
  await sm.recordCommand("record");

  const scan = await readLatestScan(join(paths.cache, "scan"));
  const scenes = await loadAllScenes(join(paths.cache, "script"));
  const credentials = config.auth.credentials;

  let results;
  try {
    results = await runRecord({
      scenes, baseUrl: scan.base_url, config,
      outDirRoot: join(paths.cache, "record"),
      ...(credentials ? { authCredentials: credentials } : {}),
      ...(config.auth.storage_state_path ? { storageStatePath: config.auth.storage_state_path } : {})
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "record stage failed");
    return 1;
  }

  for (const r of results) {
    await sm.markSegmentStage(r.segment_id, "record", "ok");
  }
  await sm.markStageComplete("record");

  if (config.record.gate_3_enabled && opts.printMarkdown !== false) {
    process.stdout.write(formatRecordMarkdown(results) + "\n");
  }
  logger.info({ segments: results.length }, "record stage complete");
  return 0;
}
```

- [ ] **Step 4: Wire `record` into `src/index.ts`** (after `tts`):

```typescript
program
  .command("record")
  .description("Record per-segment Playwright video + cursor track from scene.json")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--no-markdown", "suppress Gate 3 markdown output")
  .action(async (opts) => {
    const { recordCommand } = await import("./commands/record.js");
    const code = await recordCommand({ cwd: opts.cwd, printMarkdown: opts.markdown !== false });
    process.exit(code);
  });
```

- [ ] **Step 5: Build + commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/index.ts packages/cli/src/record/seed.ts packages/cli/src/commands/record.ts packages/cli/src/index.ts
git commit -m "feat(cli): add 'tutorialvid record' command (Playwright video + cursor track per segment)"
```

---

## Task 12: TTS + Record E2E test (boundary checks)

**Files:**
- Create: `packages/cli/tests/e2e/tts-record.test.ts`

> Like Plan 2, the E2E exercises the *failure path* of TTS + record without burning real API credits. Real-API runs land in the manual-test checklist.

- [ ] **Step 1: Create the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import { readdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

let server: ResultPromise | undefined;
const fixtureRoot = resolve(__dirname, "../../../../fixtures/sample-app");
const cliBin = resolve(__dirname, "../../bin/tutorialvid");
const pluginRoot = resolve(__dirname, "../../../plugin");

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: {
    mode: "waterfall",
    credentials: {
      username_env: "TV_USER", password_env: "TV_PASS",
      username_selector: "[data-test=username]", password_selector: "[data-test=password]",
      submit_selector: "[data-test=submit]", login_url: "/login"
    }
  },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "FAKE_GEMINI_KEY", language: "en-US",
    model: "gemini-2.5-flash-tts",
    voices: { friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" },
    speed_per_tone: { friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 },
    chunk_max_chars: 800
  },
  anthropic: { api_key_env: "FAKE_ANTHROPIC_KEY", model: "claude-sonnet-4-6", max_concurrency: 2 },
  script: { depth: "medium", tone: "friendly", language: "en-US" },
  record: {
    headless: true, viewport: { width: 1920, height: 1080 },
    selector_retry: 3, selector_retry_backoff_ms: 100,
    cursor_poll_hz: 60, auth_recover: true,
    gate_3_enabled: false, max_segment_concurrency: 1
  }
};

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
  server.catch(() => {});
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("dev server did not start");
}, 60_000);
afterAll(() => server?.kill("SIGTERM"));

describe("e2e: tts + record", () => {
  it("scan → plan → tts (no key) exits cleanly with clear error", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-tts-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    const scanRun = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }, reject: false
    });
    expect(scanRun.exitCode, scanRun.stderr).toBe(0);

    const planRun = await execa("node", [cliBin, "plan", "--cwd", target, "--top-n", "1"], { reject: false });
    expect(planRun.exitCode, planRun.stderr).toBe(0);

    // synthesise script artefacts manually (skip Anthropic — no key)
    const scriptDir = join(target, ".tutorialvid/cache/script/s01_dashboard");
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(scriptDir, "fakehash.scene.json"), JSON.stringify({
      segment_id: "s01_dashboard", page_id: "dashboard",
      depth: "medium", tone: "friendly", target_duration_s: 75,
      actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }],
      narration: { text: "Hello.", ssml: "<speak>Hello.</speak>", alignments: [] }
    }));

    const ttsRun = await execa("node", [cliBin, "tts", "--cwd", target], {
      env: { ...process.env, FAKE_GEMINI_KEY: "" }, reject: false
    });
    expect(ttsRun.exitCode).not.toBe(0);
    expect(ttsRun.stderr + ttsRun.stdout).toMatch(/FAKE_GEMINI_KEY|api.*key/i);
  }, 120_000);
});
```

- [ ] **Step 2: Build + run**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test e2e/tts-record
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/tests/e2e/tts-record.test.ts
git commit -m "test(e2e): tts + record orchestrator boundary check (no API key path)"
```

---

## Task 13: Skill extension + manual checklist + tag v0.0.3-plan3

**Files:**
- Modify: `packages/plugin/skills/tutorialvid-create/SKILL.md`
- Modify: `packages/plugin/.claude-plugin/plugin.json` — version 0.0.3
- Modify: `packages/plugin/package.json` — version 0.0.3
- Modify: `docs/manual-test-checklist.md`
- Modify: `Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md`

- [ ] **Step 1: Replace SKILL.md "Capability" section** to describe the four-stage pipeline (scan → plan → script → tts → record):

```markdown
## Capability (v0.0.3)

Pipeline supports five stages: **scan → plan → script → tts → record**, with Gates 1, 2, and (opt-in) 3.

### Flow

1. **Scan**: `tutorialvid scan --cwd <root>` — list framework, pages, top-5 by importance, warnings.
2. **Plan — Gate 1**: `tutorialvid plan --cwd <root>` — markdown table, user approves/edits.
3. **Script — Gate 2**: `tutorialvid script --cwd <root>` — needs `ANTHROPIC_API_KEY`.
4. **TTS**: `tutorialvid tts --cwd <root>` — needs `GEMINI_API_KEY`. Synthesises mp3 + timing per segment.
5. **Record — Gate 3 (opt-in)**: `tutorialvid record --cwd <root>` — drives Playwright per scene.json with auth waterfall + cursor track. If `config.record.gate_3_enabled: true`, prints raw clip paths for the user to mark redo.

### Auth

- A (recommended): provide login creds via env vars + selectors in `config.auth.credentials`. Plugin logs in via UI.
- B (extra tokens): export storageState.json once, point `config.auth.storage_state_path` at it.
- C: deferred to Plan 4 (inline tutorial login).

### What this skill must NOT do

- Manipulate mp4 or audio bytes directly.
- Hardcode API keys.
- Run `tts` without `GEMINI_API_KEY` or `record` without successful auth — surface the clear error.
- Enable `gate_3_enabled` by default — only opt-in for High-depth tutorials.
```

- [ ] **Step 2: Bump plugin versions to 0.0.3**

- [ ] **Step 3: Append Plan 3 acceptance to `docs/manual-test-checklist.md`**

```markdown

## Plan 3 acceptance: tts + record + Gate 3

Prereqs: `GEMINI_API_KEY` set, scan + plan + script already run, `TV_USER`/`TV_PASS` set, `localhost:5173` dev server up.

- [ ] `tutorialvid tts --cwd <root>` synthesises one mp3 per chunk under `cache/script/<segment>/`. Real audio plays back.
- [ ] Re-running `tutorialvid tts` with no script change is idempotent.
- [ ] `tutorialvid record --cwd <root>` produces an mp4 + cursor.json per segment under `cache/record/<segment>/`.
- [ ] Recording uses headless Chromium at 1920x1080 by default.
- [ ] Setting `record.headless: false` opens a visible browser.
- [ ] Selector retry kicks in when an `[data-test=...]` is briefly absent (mount delay).
- [ ] Setting `record.gate_3_enabled: true` prints the Gate 3 markdown for the user.
- [ ] Storage-state mode (B) loads cookies and skips the login flow.
- [ ] Auth-expiry recovery: artificially clear the session mid-run; recorder re-authenticates and resumes.
- [ ] Per-segment state advances `tts` then `record` to `ok`.
```

- [ ] **Step 4: Append vault close-out for Plan 3** at the end of the brainstorm session log.

- [ ] **Step 5: Commit + tag**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin docs/manual-test-checklist.md Vault/
git commit -m "docs: Plan 3 skill + checklist + vault close-out"
git tag -a v0.0.3-plan3 -m "Plan 3 complete: tts + record + Gate 3"
```

- [ ] **Step 6: Final verification**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && git tag -l
```

Expected: ~85+ tests pass. Build clean. Tags `v0.0.1-plan1`, `v0.0.2-plan2`, `v0.0.3-plan3`.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 3 covers spec §4.4 (TTS adapter, SSML chunking, voice mapping, mp3 + timing), §4.5 (Playwright runner with auth waterfall A→B→C, seed step, scene action driver, cursor track, selector retry, auth expiry recovery), §8 Gate 3 (opt-in raw clip preview), §10 (selector flakiness retry, auth expiry recovery handler). Deferred to Plan 4: compose stage (Remotion + ffmpeg + branding + music + watermark + Gate 4).

**Placeholder scan** — three explicitly-flagged simplifications:
1. Per-word timing in `gemini.ts` is a heuristic (even distribution across the chunk). Real timing via ffprobe / forced alignment is a Plan-5 polish item.
2. Cursor coordinates on click events are `(0, 0)` placeholders. Plan 5 will refine to real `page.mouse` coordinates.
3. Auth mode "inline" (C) is a no-op stub. Plan 4 will record the login flow as the first segment when this mode is selected.

Each is called out with a one-sentence rationale and a known follow-up plan. Not "TBD" — explicit scope decisions.

**Type consistency** — `Tone` is consistent across `tts/types.ts`, `tts/voices.ts`, `script/types.ts`, `plan/types.ts`. `SceneJson` flows from script → tts (reads narration.ssml) → record (reads actions). `RecordSegmentResult` is the runRecord return shape and the format formatter input. Config schema additions don't break any existing tests because everything has defaults.

**Architecture decisions locked**:
- TTS: Gemini SDK direct (analogous to Anthropic in Plan 2). API key via env. Chunked synthesis at <break> + sentence boundaries. Voice + speed per tone. Real-API tests deferred to manual checklist; CI exercises only failure paths and orchestration.
- Record: Playwright reused from Plan 1 (same Chromium install). Auth waterfall A→B→C as 3 distinct functions; mode picked at runtime by config. Cursor track is event-based, not 60Hz polling — simpler, matches Playwright's mouse event model. Mode C ("inline") is a stub for Plan 4.
- Concurrency: TTS chunks are serial within a segment (cumulative timing); segments themselves are serial in v0.0.3 (`max_segment_concurrency: 1`) to avoid Playwright resource contention. Plan 5 polish may parallelise.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-3-tts-and-record.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
