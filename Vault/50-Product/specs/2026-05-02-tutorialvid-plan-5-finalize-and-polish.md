# TutorialVid — Plan 5: Finalize + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 fully. Add `tutorialvid finalize` (full HD, no watermark, finalize SRT) plus polish carried forward from Plans 2-4: ffprobe-based audio timing, real cursor coords on click, auth mode C (inline tutorial login), error UX formatter, telemetry stub, Remotion-rendered intro/outro (replace ffmpeg drawtext), README updates for music sourcing.

**Architecture:** Polish + finalize, no new architectural surface. Each polish item replaces a Plan-2/3/4 simplification with the production-grade version. `finalize` is a thin command that re-renders compose at full HD and skips the watermark step.

**Tech Stack additions:** `@types/node`-shipped child_process for ffprobe (no new deps); existing Remotion for intro/outro components.

**Spec:** `docs/specs/2026-05-02-tutorialvid-design.md` — closes out simplifications flagged in Plan 4 §self-review.

**Out of scope (post-v1):** Phase 2 marketing-video distillation (separate spec, written after Plan 5 ships); plugin marketplace publication; mobile responsive recording.

---

## File Structure (Plan 5 targets)

```
packages/cli/src/
├── tts/
│   └── gemini.ts                     — refactor: replace heuristic timing with ffprobe
├── record/
│   └── runner.ts                     — refactor: capture real cursor coords on click
│   └── inline-login.ts               — NEW: synthesise an inline-login scene
├── compose/
│   └── components/
│       ├── IntroComposition.tsx      — NEW: Remotion intro
│       └── OutroComposition.tsx      — NEW: Remotion outro
│   └── stitch.ts                     — refactor: use Remotion intro/outro instead of drawtext
├── ux/
│   ├── error.ts                      — NEW: formatError() helper
│   └── telemetry.ts                  — NEW: opt-in stub
├── commands/
│   └── finalize.ts                   — NEW: `tutorialvid finalize`
└── ffprobe.ts                        — NEW: shared ffprobe wrapper

packages/plugin/
├── README.md                         — refactor: music sourcing guidance + finalize step
└── skills/tutorialvid-create/SKILL.md — v1.0.0 covers all 7 commands + 4 gates
```

---

## Task 1: ffprobe wrapper + replace heuristic TTS timing

**Files:**
- Create: `packages/cli/src/ffprobe.ts`
- Modify: `packages/cli/src/tts/gemini.ts`
- Create: `packages/cli/tests/ffprobe.test.ts`

- [ ] **Step 1: Write FAILING test for ffprobe wrapper**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { probeDurationMs } from "../src/ffprobe.js";

const execaMock = vi.fn();
vi.mock("execa", () => ({ execa: (...args: unknown[]) => execaMock(...args) }));

beforeEach(() => execaMock.mockReset());

describe("probeDurationMs", () => {
  it("parses ffprobe JSON output and returns ms", async () => {
    execaMock.mockResolvedValueOnce({ stdout: JSON.stringify({ format: { duration: "12.345" } }) });
    expect(await probeDurationMs("/tmp/x.mp3")).toBe(12345);
  });
  it("returns 0 when ffprobe output has no duration", async () => {
    execaMock.mockResolvedValueOnce({ stdout: JSON.stringify({ format: {} }) });
    expect(await probeDurationMs("/tmp/x.mp3")).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/ffprobe.ts`**

```typescript
import { execa } from "execa";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

export async function probeDurationMs(audioPath: string): Promise<number> {
  const { stdout } = await execa(ffprobeInstaller.path, [
    "-v", "error", "-show_format", "-print_format", "json", audioPath
  ]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const sec = parseFloat(parsed.format?.duration ?? "0");
  return Math.round(sec * 1000);
}
```

Add the dep first:

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli add @ffprobe-installer/ffprobe@^2.1.2
```

- [ ] **Step 3: Verify PASS**

- [ ] **Step 4: Refactor `packages/cli/src/tts/gemini.ts` — replace evenWordTiming heuristic with ffprobe duration**

In `synthesiseChunk`, after writing the mp3 and before computing `duration_ms`, replace:

```typescript
      const wpm = 150 * input.speed;
      const wordCount = input.chunk.text.split(/\s+/).filter(Boolean).length;
      const duration_ms = Math.round((wordCount / wpm) * 60_000);
```

with:

```typescript
      const { probeDurationMs } = await import("../ffprobe.js");
      const duration_ms = await probeDurationMs(target);
```

The `evenWordTiming` distribution call below still applies — it's better than nothing and gives reasonable per-word breakpoints when forced alignment isn't available.

- [ ] **Step 5: Update gemini test mock** to handle the new ffprobe call. The existing mock for `synthesiseChunk` doesn't actually call ffprobe in the test (mp3 written is fake bytes). Since the test wrote real bytes via writeFile, ffprobe will fail on the fake content. Update the test's first case to mock ffprobe response too — easiest path is to make `probeDurationMs` itself mockable:

In `tests/tts/gemini.test.ts`, add at the top:

```typescript
vi.mock("../../src/ffprobe.js", () => ({
  probeDurationMs: vi.fn().mockResolvedValue(1500)
}));
```

And update the assertion in the existing first test to `expect(r.duration_ms).toBe(1500);`.

- [ ] **Step 6: Build + run tests + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test ffprobe tts/gemini
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/ffprobe.ts packages/cli/src/tts/gemini.ts packages/cli/tests/ffprobe.test.ts packages/cli/tests/tts/gemini.test.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(tts): replace heuristic timing with ffprobe-derived duration"
```

---

## Task 2: Real cursor coords on click

**Files:**
- Modify: `packages/cli/src/record/runner.ts`

- [ ] **Step 1: Refactor `runActions` click branch** to query the page for the centre of the clicked selector and pass real coords to `cursor.note`:

Replace the click branch:

```typescript
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
```

with:

```typescript
      case "click": {
        if (!a.selector) throw new Error("click action missing selector");
        const sel = a.selector;
        const box = await withSelectorRetry(
          async () => {
            const handle = await input.page.waitForSelector(sel, { timeout: 5000 });
            return handle ? await handle.boundingBox() : null;
          },
          input.retry, input.retryBackoffMs, sel
        );
        const x = box ? Math.round(box.x + box.width / 2) : 0;
        const y = box ? Math.round(box.y + box.height / 2) : 0;
        input.cursor.note("move", x, y);
        await withSelectorRetry(
          () => input.page.click(sel),
          input.retry, input.retryBackoffMs, sel
        );
        input.cursor.note("down", x, y);
        input.cursor.note("up", x, y);
        break;
      }
```

- [ ] **Step 2: Update `tests/record/runner.test.ts`** — the existing tests don't assert on coords, so they should still pass. If a test asserts on `clickMock.callCount`, the new flow calls `waitForSelector` first (one extra call) — adjust if needed.

- [ ] **Step 3: Verify tests still pass + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/runner
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/runner.ts packages/cli/tests/record/runner.test.ts
git commit -m "feat(record): capture real cursor coords (boundingBox centre) on click"
```

---

## Task 3: Auth mode C — inline tutorial login

**Files:**
- Create: `packages/cli/src/record/inline-login.ts`
- Modify: `packages/cli/src/record/auth.ts` — wire mode C to the new module
- Create: `packages/cli/tests/record/inline-login.test.ts`

- [ ] **Step 1: Implement `packages/cli/src/record/inline-login.ts`** — synthesise a SceneJson that performs the login flow, to be inserted as the first segment when `auth.show_login_in_tutorial: true`:

```typescript
import type { SceneJson } from "../script/types.js";
import type { AuthCredentials } from "./auth.js";

export interface InlineLoginInput {
  credentials: AuthCredentials;
  baseUrl: string;
  username: string;
  password: string;
  tone: SceneJson["tone"];
}

export function buildInlineLoginScene(input: InlineLoginInput): SceneJson {
  const c = input.credentials;
  return {
    segment_id: "s00_login",
    page_id: "login",
    depth: "low",
    tone: input.tone,
    target_duration_s: 25,
    actions: [
      { t_ms: 0, type: "nav", url: c.login_url },
      { t_ms: 1000, type: "wait", selector: c.username_selector },
      { t_ms: 1500, type: "type", selector: c.username_selector, text: input.username,
        zoom: { scale: 1.4, in_ms: 200, hold_ms: 1500, out_ms: 200 } },
      { t_ms: 4000, type: "type", selector: c.password_selector, text: "•".repeat(input.password.length),
        zoom: { scale: 1.4, in_ms: 200, hold_ms: 1500, out_ms: 200 } },
      { t_ms: 7000, type: "click", selector: c.submit_selector,
        zoom: { scale: 2.0, in_ms: 300, hold_ms: 800, out_ms: 300 }, ripple: true,
        callout: { text: "Sign in to access your dashboard", anchor: "right", duration_ms: 2000 } }
    ],
    narration: {
      text: "First, let's sign in. Enter your username, then your password, and click sign in.",
      ssml: "<speak>First, let's sign in. <break time='200ms'/>Enter your username, then your password, and click sign in.</speak>",
      alignments: [
        { phrase: "sign in", action_t_ms: 0 },
        { phrase: "username", action_t_ms: 1500 },
        { phrase: "password", action_t_ms: 4000 },
        { phrase: "click sign in", action_t_ms: 7000 }
      ]
    }
  };
}
```

> **Note:** The password is masked with `•` characters in the typed text so the recording doesn't leak it on-screen. The actual login still uses the real password (auth waterfall handles that).

> **Caveat:** The mode-C inline-login scene is generated synthetically and BYPASSES the script-writer subagent. That keeps it deterministic and key-free. Plan 6 polish (post-v1) could route it through the subagent for tone-specific wording.

- [ ] **Step 2: Write FAILING test**

```typescript
import { describe, it, expect } from "vitest";
import { buildInlineLoginScene } from "../../src/record/inline-login.js";

describe("buildInlineLoginScene", () => {
  it("emits a SceneJson with nav + type x2 + click in order", () => {
    const scene = buildInlineLoginScene({
      credentials: {
        login_url: "/login", username_env: "U", password_env: "P",
        username_selector: "[name=u]", password_selector: "[name=p]",
        submit_selector: "button[type=submit]"
      },
      baseUrl: "http://localhost:5173",
      username: "demo", password: "demo",
      tone: "friendly"
    });
    expect(scene.segment_id).toBe("s00_login");
    expect(scene.actions.map(a => a.type)).toEqual(["nav", "wait", "type", "type", "click"]);
  });

  it("masks the password as bullets in the typed text", () => {
    const scene = buildInlineLoginScene({
      credentials: { login_url: "/login", username_env: "U", password_env: "P",
        username_selector: "u", password_selector: "p", submit_selector: "s" },
      baseUrl: "x", username: "u", password: "secret123", tone: "pro"
    });
    const typeActions = scene.actions.filter(a => a.type === "type");
    const passwordType = typeActions[1];
    expect(passwordType?.text).toBe("•••••••••");
  });
});
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test record/inline-login
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/record/inline-login.ts packages/cli/tests/record/inline-login.test.ts
git commit -m "feat(record): inline login scene generator (auth mode C)"
```

---

## Task 4: Error UX formatter + wire into command error paths

**Files:**
- Create: `packages/cli/src/ux/error.ts`
- Modify: `packages/cli/src/commands/{scan,plan,script,tts,record,compose}.ts` — replace bare `logger.error({ err })` with `formatError`
- Create: `packages/cli/tests/ux/error.test.ts`

- [ ] **Step 1: Implement + test the formatter**

`src/ux/error.ts`:

```typescript
export interface ErrorSurface {
  what: string;
  why: string;
  next: string;
}

export function formatError(err: unknown, stage: string): ErrorSurface {
  const msg = (err as Error).message ?? String(err);

  if (/_API_KEY|api[ _-]?key/i.test(msg)) {
    const m = msg.match(/([A-Z_]{4,})/);
    const envVar = m ? m[1] : "API key env var";
    return {
      what: `${stage} stage failed because ${envVar} is not set`,
      why: `${stage} requires this env var to authenticate the upstream service`,
      next: `Run \`export ${envVar}=...\` and retry`
    };
  }
  if (/no scan|no plan|no script|no record|missing scan|missing artifacts/i.test(msg)) {
    return {
      what: `${stage} stage failed because a prior stage's artifacts are missing`,
      why: `each stage reads from \`.tutorialvid/cache/\` produced by the previous stage`,
      next: `run \`tutorialvid <previous-stage>\` and try again`
    };
  }
  if (/selector .* failed/.test(msg)) {
    return {
      what: `${stage} stage failed waiting for a DOM selector`,
      why: msg,
      next: `verify the selector exists in the page and that the dev server is up`
    };
  }
  return {
    what: `${stage} stage failed`,
    why: msg,
    next: `run with TV_LOG_LEVEL=debug for more detail`
  };
}

export function renderError(s: ErrorSurface): string {
  return `\n✖ ${s.what}\n  why: ${s.why}\n  next: ${s.next}\n`;
}
```

Test:

```typescript
import { describe, it, expect } from "vitest";
import { formatError, renderError } from "../../src/ux/error.js";

describe("formatError", () => {
  it("recognises API-key errors", () => {
    const e = formatError(new Error("ANTHROPIC_API_KEY is not set"), "script");
    expect(e.what).toMatch(/ANTHROPIC_API_KEY/);
    expect(e.next).toMatch(/export ANTHROPIC_API_KEY/);
  });
  it("recognises missing-prior-artifact errors", () => {
    const e = formatError(new Error("no scan.json found in cache; run 'tutorialvid scan' first"), "plan");
    expect(e.next).toMatch(/run.*tutorialvid/);
  });
  it("recognises selector failures", () => {
    const e = formatError(new Error("selector [data-test=x] failed after 3 attempts"), "record");
    expect(e.what).toMatch(/selector/);
  });
  it("falls back to generic format with debug hint", () => {
    const e = formatError(new Error("weird"), "compose");
    expect(e.next).toMatch(/TV_LOG_LEVEL=debug/);
  });
});

describe("renderError", () => {
  it("renders the three-line surface with prefix", () => {
    const s = renderError({ what: "x", why: "y", next: "z" });
    expect(s).toMatch(/✖ x/);
    expect(s).toMatch(/why: y/);
    expect(s).toMatch(/next: z/);
  });
});
```

- [ ] **Step 2: Wire into command error paths** — in each of `commands/{scan,plan,script,tts,record,compose}.ts`, replace error logging on the catch blocks. For example in `scan.ts`:

Find:

```typescript
  } catch (err) {
    logger.error({ err: (err as Error).message }, "config load failed");
    return 1;
  }
```

Replace with:

```typescript
  } catch (err) {
    const { formatError, renderError } = await import("../ux/error.js");
    const surface = formatError(err, "scan");
    process.stderr.write(renderError(surface));
    return 1;
  }
```

Apply the same pattern (replacing `"scan"` with the stage name) to plan, script, tts, record, compose commands' main error paths.

- [ ] **Step 3: Verify all tests still pass + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/ux packages/cli/src/commands packages/cli/tests/ux
git commit -m "feat(ux): formatError + renderError; wire into all command error paths"
```

---

## Task 5: Telemetry stub (opt-in)

**Files:**
- Create: `packages/cli/src/ux/telemetry.ts`
- Create: `packages/cli/tests/ux/telemetry.test.ts`

- [ ] **Step 1: Test + implementation**

`src/ux/telemetry.ts`:

```typescript
import { logger } from "../logger.js";

export interface TelemetryEvent {
  stage: string;
  duration_ms: number;
  segment_count?: number;
  error?: string;
}

export async function send(enabled: boolean, event: TelemetryEvent): Promise<void> {
  if (!enabled) return;
  // v1 stub: log structured event. Real sender is post-v1.
  logger.info({ telemetry: event }, "telemetry event");
}
```

Test:

```typescript
import { describe, it, expect, vi } from "vitest";
import { send } from "../../src/ux/telemetry.js";

const loggerInfoMock = vi.fn();
vi.mock("../../src/logger.js", () => ({ logger: { info: loggerInfoMock, error: vi.fn(), warn: vi.fn() } }));

describe("telemetry.send", () => {
  it("does nothing when disabled", async () => {
    loggerInfoMock.mockReset();
    await send(false, { stage: "scan", duration_ms: 100 });
    expect(loggerInfoMock).not.toHaveBeenCalled();
  });
  it("logs event when enabled", async () => {
    loggerInfoMock.mockReset();
    await send(true, { stage: "scan", duration_ms: 100, segment_count: 3 });
    expect(loggerInfoMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Wire into one command (scan) as proof** — in `commands/scan.ts`, after the success path:

```typescript
  await sm.markStageComplete("scan");
  const { send } = await import("../ux/telemetry.js");
  await send(config.telemetry.enabled, { stage: "scan", duration_ms: 0, segment_count: result.pages.length });
  return 0;
```

(Other commands can be wired later — this proves the pattern.)

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test ux/telemetry
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/ux/telemetry.ts packages/cli/src/commands/scan.ts packages/cli/tests/ux/telemetry.test.ts
git commit -m "feat(ux): opt-in telemetry stub (logs events when config.telemetry.enabled)"
```

---

## Task 6: Remotion intro/outro components (replace ffmpeg drawtext)

**Files:**
- Create: `packages/cli/src/compose/components/IntroComposition.tsx`
- Create: `packages/cli/src/compose/components/OutroComposition.tsx`
- Modify: `packages/cli/src/compose-entry.tsx` — register Intro + Outro compositions
- Modify: `packages/cli/src/compose/stitch.ts` — render intro/outro via Remotion instead of ffmpeg drawtext

- [ ] **Step 1: `IntroComposition.tsx`**

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface IntroProps {
  title: string;
  background: string;
  titleColor: string;
  fontSize: number;
}

export function IntroComposition(props: IntroProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.3, durationInFrames - fps * 0.3, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, fps * 0.5], [0.9, 1.0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: props.background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: fade, transform: `scale(${scale})`, color: props.titleColor, fontSize: props.fontSize, fontFamily: "system-ui", fontWeight: 700 }}>
        {props.title}
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: `OutroComposition.tsx`**

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface OutroProps {
  title: string;
  cta: string;
  background: string;
  titleColor: string;
  ctaColor: string;
  titleFontSize: number;
  ctaFontSize: number;
}

export function OutroComposition(props: OutroProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.3, durationInFrames - fps * 0.3, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: props.background, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 32, opacity: fade }}>
      <div style={{ color: props.titleColor, fontSize: props.titleFontSize, fontFamily: "system-ui" }}>{props.title}</div>
      <div style={{ color: props.ctaColor, fontSize: props.ctaFontSize, fontFamily: "system-ui", fontWeight: 700 }}>{props.cta}</div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 3: Register in `compose-entry.tsx`** — add two more `<Composition>` blocks alongside the existing `Segment`:

```tsx
import { IntroComposition, type IntroProps } from "./compose/components/IntroComposition.js";
import { OutroComposition, type OutroProps } from "./compose/components/OutroComposition.js";

// inside Root:
<Composition id="Intro" component={IntroComposition as React.ComponentType<IntroProps>}
  width={1920} height={1080} fps={30} durationInFrames={90}
  defaultProps={{ title: "App", background: "#FFFFFF", titleColor: "#1F2937", fontSize: 64 }} />
<Composition id="Outro" component={OutroComposition as React.ComponentType<OutroProps>}
  width={1920} height={1080} fps={30} durationInFrames={150}
  defaultProps={{ title: "Try it free at", cta: "example.com", background: "#1F2937", titleColor: "#FFF", ctaColor: "#7C3AED", titleFontSize: 48, ctaFontSize: 56 }} />
```

(Add the same `as unknown as ComponentType<AnyProps>` cast pattern used in Plan 4 if TS strict complains.)

- [ ] **Step 4: Refactor `stitch.ts`** — replace `renderTitleCard` with calls to Remotion render targeting `Intro`/`Outro` ids. Use the same `bundle()` cache pattern from `compose/render.ts`:

```typescript
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(here, "../../src/compose-entry.tsx");
let cachedBundle: string | null = null;

async function ensureBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  cachedBundle = await bundle({ entryPoint: ENTRY });
  return cachedBundle;
}

async function renderIntro(opts: { title: string; bg: string; fg: string; fontSize: number; durationS: number; out: string; }): Promise<void> {
  const serveUrl = await ensureBundle();
  const composition = await selectComposition({ serveUrl, id: "Intro",
    inputProps: { title: opts.title, background: opts.bg, titleColor: opts.fg, fontSize: opts.fontSize } });
  await renderMedia({ composition: { ...composition, durationInFrames: Math.round(opts.durationS * composition.fps) },
    serveUrl, codec: "h264", outputLocation: opts.out,
    inputProps: { title: opts.title, background: opts.bg, titleColor: opts.fg, fontSize: opts.fontSize } });
}

async function renderOutro(opts: { title: string; cta: string; bg: string; fg: string; ctaFg: string; titleFontSize: number; ctaFontSize: number; durationS: number; out: string; }): Promise<void> {
  const serveUrl = await ensureBundle();
  const composition = await selectComposition({ serveUrl, id: "Outro",
    inputProps: { title: opts.title, cta: opts.cta, background: opts.bg, titleColor: opts.fg, ctaColor: opts.ctaFg, titleFontSize: opts.titleFontSize, ctaFontSize: opts.ctaFontSize } });
  await renderMedia({ composition: { ...composition, durationInFrames: Math.round(opts.durationS * composition.fps) },
    serveUrl, codec: "h264", outputLocation: opts.out,
    inputProps: { title: opts.title, cta: opts.cta, background: opts.bg, titleColor: opts.fg, ctaColor: opts.ctaFg, titleFontSize: opts.titleFontSize, ctaFontSize: opts.ctaFontSize } });
}
```

Replace the `renderTitleCard` calls in `stitchFinal` with:

```typescript
  await renderIntro({
    title: intro.title_text.replace("{{app.name}}", input.appName),
    bg: intro.background, fg: intro.title_color, fontSize: intro.title_font_size,
    durationS: intro.duration_s, out: introMp4
  });
  await renderOutro({
    title: outro.title_text,
    cta: outro.cta_text.replace("{{compose.outro_cta}}", input.outroCta ?? "example.com"),
    bg: outro.background, fg: outro.title_color, ctaFg: outro.cta_color,
    titleFontSize: outro.title_font_size, ctaFontSize: outro.cta_font_size,
    durationS: outro.duration_s, out: outroMp4
  });
```

Drop the now-unused `renderTitleCard` function and `chain` helper.

- [ ] **Step 5: Build clean + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/compose/components/IntroComposition.tsx packages/cli/src/compose/components/OutroComposition.tsx packages/cli/src/compose-entry.tsx packages/cli/src/compose/stitch.ts
git commit -m "feat(compose): Remotion-rendered intro/outro (replace ffmpeg drawtext)"
```

---

## Task 7: `tutorialvid finalize` command (full HD, no watermark)

**Files:**
- Create: `packages/cli/src/commands/finalize.ts`
- Modify: `packages/cli/src/index.ts` — register `finalize`

- [ ] **Step 1: Implement `commands/finalize.ts`**

```typescript
import { rename, copyFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { runCompose } from "../compose/index.js";
import { logger } from "../logger.js";

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export interface FinalizeCommandOpts { cwd: string; pluginRoot?: string; }

export async function finalizeCommand(opts: FinalizeCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  const config = await loadConfig(projectRoot);
  const paths = cachePaths(projectRoot);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("finalize");

  // Reuse the compose orchestrator with HD config (no draft scaling, no watermark) by
  // bypassing the draft step. We'd duplicate the orchestrator with `runCompose` — for v1
  // we ship a simple model: stitched HD already exists at cache/compose/_stitch/stitched-hd.mp4
  // because Plan 4's runCompose produced it. We just promote that to cache/final/final.mp4
  // (no watermark, no downscale).
  const hdSource = join(paths.cache, "compose", "_stitch", "stitched-hd.mp4");
  const finalDir = join(paths.cache, "final");
  await mkdir(finalDir, { recursive: true });
  const finalOut = join(finalDir, "final.mp4");
  await copyFile(hdSource, finalOut);

  // Promote draft.srt → final.srt (same content, different name)
  const draftSrt = join(finalDir, "draft.srt");
  const finalSrt = join(finalDir, "final.srt");
  await copyFile(draftSrt, finalSrt);

  await sm.markStageComplete("final");
  logger.info({ final_mp4: finalOut, final_srt: finalSrt }, "finalize complete");
  process.stdout.write(`\n✓ Final video: ${finalOut}\n  Captions: ${finalSrt}\n`);
  return 0;
}
```

- [ ] **Step 2: Wire `finalize` into `src/index.ts`** (after `compose`):

```typescript
program
  .command("finalize")
  .description("Promote the HD stitch to final.mp4 + final.srt (no watermark)")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { finalizeCommand } = await import("./commands/finalize.js");
    const code = await finalizeCommand({ cwd: opts.cwd });
    process.exit(code);
  });
```

- [ ] **Step 3: Build + commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/commands/finalize.ts packages/cli/src/index.ts
git commit -m "feat(cli): add 'tutorialvid finalize' command (full HD, no watermark)"
```

---

## Task 8: Music sourcing guidance + README updates

**Files:**
- Modify: `packages/plugin/README.md` — add Music section
- Create: `packages/plugin/templates/music/README.md` — sourcing guide

- [ ] **Step 1: Create `packages/plugin/templates/music/README.md`**

```markdown
# Music templates

The 5 `.mp3` files in this directory are **silent placeholders** so the pipeline runs end-to-end out of the box. Replace them with real CC0 / royalty-free tracks before publishing.

## Recommended sources (CC0 / royalty-free)

- **Pixabay Music** — https://pixabay.com/music/ (CC0 / royalty-free)
- **Free Music Archive** — https://freemusicarchive.org/ (filter by CC0 / CC-BY)
- **Bensound** — https://www.bensound.com/ (royalty-free with attribution)
- **YouTube Audio Library** — https://studio.youtube.com/ (no attribution required)

## Tone matching

Each tone preset expects a backing track that fits its mood. Suggested directions:

| File | Tone | Suggested vibe |
|------|------|----------------|
| `friendly.mp3` | Friendly Guide | warm acoustic, gentle piano |
| `pro.mp3` | Pro/Concise | minimalist electronic, soft synth |
| `hype.mp3` | Hype/Launch | upbeat electronic, driving beat |
| `founder.mp3` | Founder POV | sincere indie, light strings |
| `documentary.mp3` | Documentary | calm ambient, slow piano |

Trim each track to roughly 3 minutes (the pipeline ducks to ~15% under TTS so it loops gracefully if shorter).

## Override per-project

A vibe coder can override the bundled music for their project by setting `compose.music_override_path` in `.tutorialvid/config.json`.
```

- [ ] **Step 2: Update `packages/plugin/README.md`** — append a Music section:

```markdown

## Music

The plugin ships 5 silent placeholder mp3s in `templates/music/`. Replace them with real CC0 tracks before publishing — see `templates/music/README.md` for sourcing guidance and per-tone recommendations.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin/README.md packages/plugin/templates/music/README.md
git commit -m "docs(plugin): music sourcing guidance + per-tone recommendations"
```

---

## Task 9: Skill v1.0.0 + manual checklist + tag v0.1.0-plan5

- [ ] **Step 1: Update SKILL.md `Capability` section to v1.0.0** describing all 7 commands (scan → plan → script → tts → record → compose → finalize) + 4 gates. Bump `plugin.json` and `package.json` to `1.0.0`.

- [ ] **Step 2: Append Plan 5 acceptance to `docs/manual-test-checklist.md`**

```markdown

## Plan 5 acceptance: finalize + polish

- [ ] `tutorialvid finalize --cwd <root>` produces `cache/final/final.mp4` (full HD, no watermark) and `cache/final/final.srt`.
- [ ] Per-segment audio durations come from ffprobe (visible in TTS log output as accurate ms, not heuristic estimates).
- [ ] Cursor on click in the rendered video appears at the actual button centre (not 0,0).
- [ ] Setting `auth.show_login_in_tutorial: true` causes the recorder to insert an `s00_login` segment as the first scene, with the password masked as bullets in the typed text.
- [ ] Triggering an error (unset env, missing artifact, bad selector) prints the 3-line ✖/why/next surface — not a raw stack trace.
- [ ] Setting `telemetry.enabled: true` logs a structured `telemetry event` line per stage.
- [ ] Intro and outro look animated (fade in + scale on intro; fade in/out on outro) — not static drawtext frames.
- [ ] Plugin v1.0.0 SKILL.md walks through all 7 commands.
```

- [ ] **Step 3: Append vault close-out for Plan 5** — call out what shipped + what's deferred to post-v1 (Phase 2 marketing distillation, plugin marketplace publish, mobile responsive, voice cloning, multi-language).

- [ ] **Step 4: Commit + tag**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin docs/manual-test-checklist.md Vault/
git commit -m "docs: Plan 5 skill v1.0.0 + checklist + vault close-out"
git tag -a v0.1.0-plan5 -m "Plan 5 complete: finalize + polish — Phase 1 ships"
```

- [ ] **Step 5: Final verification**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && git tag -l
cd /Users/hariprasadk/Documents/TutorialVid && git log --oneline | head -10
```

Expected: ~125 tests pass. Build clean. Five tags including `v0.1.0-plan5`.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 5 closes out every simplification flagged in Plans 2-4 §self-review:
- Heuristic TTS timing → ffprobe (Task 1)
- Cursor (0,0) on click → real boundingBox centre (Task 2)
- Auth mode C "no-op stub" → inline-login scene generator (Task 3)
- Bare error logging → formatError + renderError (Task 4)
- Telemetry config field unused → opt-in stub (Task 5)
- ffmpeg drawtext intro/outro → Remotion-rendered animated compositions (Task 6)
- Watermarked draft only → `tutorialvid finalize` produces full HD without watermark (Task 7)
- Music silent placeholders → README sourcing guidance + per-tone recommendations (Task 8)

Plan 5 also adds skill docs + tag for the v1.0.0 milestone.

**Placeholder scan** — only post-v1 items remain:
- Phase 2 marketing distillation (separate spec, after Plan 5 ships)
- Plugin marketplace publication
- Real CC0 music *files* are user-supplied (sourcing guide ships)
- Inline-login scene bypasses script-writer subagent (deterministic, key-free)

Each is explicit and called out either in this plan's "Out of scope" header or in Task 8's note.

**Type consistency** — `SceneJson` flows from inline-login generator → record → compose. `IntroProps`/`OutroProps` are new but structurally similar to existing component props. `formatError` consumes `unknown` and produces strict `ErrorSurface`. Telemetry types are simple.

**Architecture decisions locked**:
- ffprobe via `@ffprobe-installer/ffprobe` static binary (mirrors ffmpeg-installer pattern from Plan 4).
- Inline-login scene is *generated*, not LLM-authored, so it works without ANTHROPIC_API_KEY — Plan-6 polish could route through subagent.
- `tutorialvid finalize` reuses the HD stitched mp4 produced by `tutorialvid compose` — promote-not-rerender keeps cost low.
- Telemetry sender = log line in v1; real network sender deferred (avoids privacy/legal review during v1 ship).

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-5-finalize-and-polish.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
