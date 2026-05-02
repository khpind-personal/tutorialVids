# TutorialVid — Plan 6: Claude Code subagents for script stage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan.

**Goal:** Refactor `tutorialvid script` so it leverages Claude Code's session (free for vibe coders already paying for the Claude Code subscription) instead of forcing a separate `ANTHROPIC_API_KEY` + Anthropic SDK call. Standalone Anthropic SDK path stays as fallback for CI / headless runs.

**Architecture:** Split the existing `tutorialvid script` command into three modes:
- `tutorialvid script-prepare` — CLI emits per-segment work payloads (JSON files containing `{ agent_name, system_prompt, user_payload }`) to `cache/script/_work/`. No LLM call.
- Skill orchestrates the loop: reads each work file, dispatches a Claude Code Task subagent (registered via the plugin's `agents/*.md`) with the system prompt + user payload, captures the JSON output to a temp result file.
- `tutorialvid script-consume` — CLI reads each result file, validates JSON, persists scene.json/txt/ssml to cache (existing logic, just lifted out of the orchestrator).
- `tutorialvid script --standalone` — original Anthropic SDK path, unchanged. Used when the CLI runs outside a Claude Code session (CI, headless).

**Tech Stack additions:** None. Reuses existing Plan 2 LLM module for `--standalone` mode; new mode adds only filesystem I/O.

**Spec:** addresses gap surfaced post-Plan-5: CLI was forcing `ANTHROPIC_API_KEY` even when invoked from a Claude Code session that already has Anthropic auth. This plan inverts so the skill is the LLM dispatcher when running inside Claude Code.

**Out of scope:** TTS still uses Gemini SDK (Claude Code has no Gemini access — `GEMINI_API_KEY` still required for `tts` stage).

---

## File Structure (Plan 6 targets)

```
packages/cli/
├── src/
│   ├── script/
│   │   ├── prepare.ts              — NEW: emit work payloads
│   │   ├── consume.ts              — NEW: read result + persist artefacts
│   │   ├── work-io.ts              — NEW: shared work/result file format + validators
│   │   └── index.ts                — refactor: extract per-segment logic for reuse
│   └── commands/
│       ├── script.ts               — refactor: dispatcher (prepare / consume / standalone)
│       ├── script-prepare.ts       — NEW: CLI subcommand
│       └── script-consume.ts       — NEW: CLI subcommand
└── tests/
    ├── script/prepare.test.ts
    ├── script/consume.test.ts
    └── script/work-io.test.ts

packages/plugin/
├── agents/
│   ├── tutorialvid-script-writer.md     — verify Claude Code agent format
│   └── tutorialvid-scene-director.md    — verify Claude Code agent format
└── skills/tutorialvid-create/SKILL.md   — refactor: drive the prepare → dispatch → consume loop
```

---

## Task 1: Work + result file schemas + work-io module

**Files:**
- Create: `packages/cli/src/script/work-io.ts`
- Create: `packages/cli/tests/script/work-io.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorkFile, readWorkFile, writeResultFile, readResultFile, validateNarrationResult, validateSceneResult } from "../../src/script/work-io.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-work-")); });

const work = {
  segment_id: "s01",
  agent_name: "tutorialvid-script-writer",
  system_prompt: "you are sw",
  user_payload: { foo: 1 }
};

describe("work-io", () => {
  it("writes + reads a work file", async () => {
    const path = await writeWorkFile(root, "s01", "writer", work);
    expect(path).toMatch(/_work\/s01\.writer\.json$/);
    const back = await readWorkFile(path);
    expect(back.segment_id).toBe("s01");
  });

  it("writes + reads a result file", async () => {
    const path = await writeResultFile(root, "s01", "writer", { text: "x", ssml: "<speak>x</speak>", alignments: [] });
    expect(path).toMatch(/_result\/s01\.writer\.json$/);
    const back = await readResultFile<{ text: string }>(path);
    expect(back.text).toBe("x");
  });

  it("validateNarrationResult passes valid shape", () => {
    expect(validateNarrationResult({ text: "x", ssml: "<speak>x</speak>", alignments: [] })).toBe(true);
  });

  it("validateNarrationResult rejects missing fields", () => {
    expect(validateNarrationResult({ text: "x" })).toBe(false);
  });

  it("validateSceneResult passes valid shape", () => {
    expect(validateSceneResult({ actions: [{ t_ms: 0, type: "nav", url: "/x" }] })).toBe(true);
  });

  it("validateSceneResult rejects empty actions", () => {
    expect(validateSceneResult({ actions: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/script/work-io.ts`**

```typescript
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

export type AgentRole = "writer" | "director";

export interface WorkFile {
  segment_id: string;
  agent_name: string;
  system_prompt: string;
  user_payload: unknown;
}

function workPath(cacheRoot: string, segmentId: string, role: AgentRole): string {
  return join(cacheRoot, "script", "_work", `${segmentId}.${role}.json`);
}

function resultPath(cacheRoot: string, segmentId: string, role: AgentRole): string {
  return join(cacheRoot, "script", "_result", `${segmentId}.${role}.json`);
}

export async function writeWorkFile(cacheRoot: string, segmentId: string, role: AgentRole, work: WorkFile): Promise<string> {
  const path = workPath(cacheRoot, segmentId, role);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(work, null, 2), "utf8");
  return path;
}

export async function readWorkFile(path: string): Promise<WorkFile> {
  return JSON.parse(await readFile(path, "utf8")) as WorkFile;
}

export async function writeResultFile(cacheRoot: string, segmentId: string, role: AgentRole, result: unknown): Promise<string> {
  const path = resultPath(cacheRoot, segmentId, role);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(result, null, 2), "utf8");
  return path;
}

export async function readResultFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function validateNarrationResult(x: unknown): boolean {
  const n = x as { text?: unknown; ssml?: unknown; alignments?: unknown };
  return !!n && typeof n.text === "string" && typeof n.ssml === "string" && Array.isArray(n.alignments);
}

export function validateSceneResult(x: unknown): boolean {
  const s = x as { actions?: unknown[] };
  return !!s && Array.isArray(s.actions) && s.actions.length > 0;
}
```

- [ ] **Step 3: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test script/work-io
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script/work-io.ts packages/cli/tests/script/work-io.test.ts
git commit -m "feat(script): work + result file IO + validators (Claude Code subagent handoff)"
```

---

## Task 2: `tutorialvid script-prepare` command

**Files:**
- Create: `packages/cli/src/script/prepare.ts`
- Create: `packages/cli/src/commands/script-prepare.ts`
- Create: `packages/cli/tests/script/prepare.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareWorkFiles } from "../../src/script/prepare.js";
import type { Plan } from "../../src/plan/types.js";
import type { ScanResult } from "../../src/scan/types.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-prep-")); });

const scan: ScanResult = {
  framework: "react-router", base_url: "http://x:5173",
  pages: [{ id: "dashboard", route: "/dashboard", title: "Dashboard", primary_actions: [], requires_auth: true, needs_seed: false, importance: 5 }],
  flows: [], warnings: []
};

const plan: Plan = {
  framework: "react-router", base_url: "http://x:5173",
  depth: "medium", tone: "friendly", language: "en-US",
  created_at: "2026-05-02T00:00:00Z",
  segments: [{ id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
    depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true }]
};

function makeAgent(p: string, name: string, body: string) {
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, `${name}.md`), `---\nname: ${name}\ndescription: x\nmodel: claude-sonnet-4-6\n---\n${body}`);
}

describe("prepareWorkFiles", () => {
  it("writes 2 work files per segment (writer + director)", async () => {
    const pluginRoot = join(root, "plugin");
    makeAgent(join(pluginRoot, "agents"), "tutorialvid-script-writer", "you are writer");
    makeAgent(join(pluginRoot, "agents"), "tutorialvid-scene-director", "you are director");
    const cacheRoot = join(root, "cache");
    const result = await prepareWorkFiles({ plan, scan, pluginRoot, cacheRoot });
    expect(result.workFiles.length).toBe(2);
    const dirs = await readdir(join(cacheRoot, "script", "_work"));
    expect(dirs.sort()).toEqual(["s01_dashboard.director.json", "s01_dashboard.writer.json"]);
  });
});
```

- [ ] **Step 2: Verify FAIL + Implement `packages/cli/src/script/prepare.ts`**

```typescript
import { loadAgentPrompt } from "../llm/prompts.js";
import { writeWorkFile } from "./work-io.js";
import type { Plan, Segment } from "../plan/types.js";
import type { ScanResult, PageEntry } from "../scan/types.js";

export interface PrepareInput {
  plan: Plan;
  scan: ScanResult;
  pluginRoot: string;
  cacheRoot: string;
}

export interface PrepareOutput {
  workFiles: { segment_id: string; role: "writer" | "director"; path: string }[];
}

function pageActionsFor(seg: Segment, scan: ScanResult): PageEntry["primary_actions"] {
  return scan.pages.find((p) => p.id === seg.page_id)?.primary_actions ?? [];
}

export async function prepareWorkFiles(input: PrepareInput): Promise<PrepareOutput> {
  const writer = await loadAgentPrompt(input.pluginRoot, "tutorialvid-script-writer");
  const director = await loadAgentPrompt(input.pluginRoot, "tutorialvid-scene-director");
  const out: PrepareOutput["workFiles"] = [];

  for (const segment of input.plan.segments) {
    const page_actions = pageActionsFor(segment, input.scan);
    const writerPath = await writeWorkFile(input.cacheRoot, segment.id, "writer", {
      segment_id: segment.id,
      agent_name: writer.name,
      system_prompt: writer.system,
      user_payload: { segment, page_actions, base_url: input.scan.base_url, language: input.plan.language }
    });
    out.push({ segment_id: segment.id, role: "writer", path: writerPath });
    // Director payload is finalised at consume-time when narration is ready; we emit a placeholder
    // here so the skill knows the director needs to run after the writer.
    const directorPath = await writeWorkFile(input.cacheRoot, segment.id, "director", {
      segment_id: segment.id,
      agent_name: director.name,
      system_prompt: director.system,
      user_payload: { segment, page_actions, narration_result_file: `_result/${segment.id}.writer.json` }
    });
    out.push({ segment_id: segment.id, role: "director", path: directorPath });
  }
  return out;
}
```

- [ ] **Step 3: Implement `packages/cli/src/commands/script-prepare.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { prepareWorkFiles } from "../script/prepare.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import type { ScanResult } from "../scan/types.js";
import type { Plan } from "../plan/types.js";

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export interface ScriptPrepareCommandOpts { cwd: string; pluginRoot?: string; }

async function readLatest<T>(dir: string): Promise<T> {
  const entries = await readdir(dir);
  const target = join(dir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as T;
}

export async function scriptPrepareCommand(opts: ScriptPrepareCommandOpts): Promise<number> {
  let config;
  try { config = await loadConfig(opts.cwd); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-prepare"))); return 1; }
  const paths = cachePaths(opts.cwd);
  try {
    const scan = await readLatest<ScanResult>(join(paths.cache, "scan"));
    const plan = await readLatest<Plan>(join(paths.cache, "plan"));
    const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;
    const out = await prepareWorkFiles({ plan, scan, pluginRoot, cacheRoot: paths.cache });
    for (const wf of out.workFiles) {
      process.stdout.write(`${wf.segment_id}\t${wf.role}\t${wf.path}\n`);
    }
    void config;
    logger.info({ count: out.workFiles.length }, "script-prepare wrote work files");
    return 0;
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "script-prepare")));
    return 1;
  }
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test script/prepare
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script/prepare.ts packages/cli/src/commands/script-prepare.ts packages/cli/tests/script/prepare.test.ts
git commit -m "feat(script): script-prepare emits per-segment work files (Claude Code dispatch handoff)"
```

---

## Task 3: `tutorialvid script-consume` command

**Files:**
- Create: `packages/cli/src/script/consume.ts`
- Create: `packages/cli/src/commands/script-consume.ts`
- Create: `packages/cli/tests/script/consume.test.ts`

- [ ] **Step 1: Write FAILING test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { consumeSegmentResults } from "../../src/script/consume.js";
import type { Segment } from "../../src/plan/types.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-cons-")); });

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true
};

describe("consumeSegmentResults", () => {
  it("reads writer + director results, persists scene.json + txt + ssml", async () => {
    const cacheRoot = join(root, "cache");
    mkdirSync(join(cacheRoot, "script", "_result"), { recursive: true });
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.writer.json"),
      JSON.stringify({ text: "Welcome.", ssml: "<speak>Welcome.</speak>", alignments: [] }));
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.director.json"),
      JSON.stringify({ actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }] }));
    const r = await consumeSegmentResults({ segment: seg, cacheRoot });
    expect(r.scene.segment_id).toBe("s01_dashboard");
    expect(r.scene.actions).toHaveLength(1);
    const txt = await readFile(join(cacheRoot, "script", "s01_dashboard", `${r.hash}.txt`), "utf8");
    expect(txt).toBe("Welcome.");
  });

  it("throws on missing writer result", async () => {
    const cacheRoot = join(root, "cache");
    await expect(consumeSegmentResults({ segment: seg, cacheRoot })).rejects.toThrow(/writer/i);
  });

  it("throws on invalid director result (empty actions)", async () => {
    const cacheRoot = join(root, "cache");
    mkdirSync(join(cacheRoot, "script", "_result"), { recursive: true });
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.writer.json"),
      JSON.stringify({ text: "x", ssml: "<speak>x</speak>", alignments: [] }));
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.director.json"),
      JSON.stringify({ actions: [] }));
    await expect(consumeSegmentResults({ segment: seg, cacheRoot })).rejects.toThrow(/empty|actions/i);
  });
});
```

- [ ] **Step 2: Verify FAIL + Implement `packages/cli/src/script/consume.ts`**

```typescript
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { readResultFile, validateNarrationResult, validateSceneResult } from "./work-io.js";
import { hashInputs } from "../cache/hash.js";
import type { Segment } from "../plan/types.js";
import type { Narration, SceneAction, SceneJson } from "./types.js";

export interface ConsumeInput {
  segment: Segment;
  cacheRoot: string;
}

export interface ConsumeOutput {
  scene: SceneJson;
  hash: string;
  scenePath: string;
}

export async function consumeSegmentResults(input: ConsumeInput): Promise<ConsumeOutput> {
  const writerPath = join(input.cacheRoot, "script", "_result", `${input.segment.id}.writer.json`);
  const directorPath = join(input.cacheRoot, "script", "_result", `${input.segment.id}.director.json`);

  let narration: Narration;
  try {
    const raw = await readResultFile<unknown>(writerPath);
    if (!validateNarrationResult(raw)) throw new Error("malformed");
    narration = raw as Narration;
  } catch (err) {
    throw new Error(`writer result for ${input.segment.id} missing or invalid: ${(err as Error).message}`);
  }

  let actions: SceneAction[];
  try {
    const raw = await readResultFile<{ actions?: SceneAction[] }>(directorPath);
    if (!validateSceneResult(raw)) throw new Error("empty actions");
    actions = raw.actions!;
  } catch (err) {
    throw new Error(`director result for ${input.segment.id} missing or invalid: ${(err as Error).message}`);
  }

  const scene: SceneJson = {
    segment_id: input.segment.id,
    page_id: input.segment.page_id,
    depth: input.segment.depth,
    tone: input.segment.tone,
    target_duration_s: input.segment.target_duration_s,
    actions,
    narration
  };
  const hash = hashInputs({ segment_id: scene.segment_id, depth: scene.depth, tone: scene.tone, narration_text: narration.text, actions_count: actions.length });
  const segDir = join(input.cacheRoot, "script", input.segment.id);
  await mkdir(segDir, { recursive: true });
  const scenePath = join(segDir, `${hash}.scene.json`);
  await writeFile(scenePath, JSON.stringify(scene, null, 2), "utf8");
  await writeFile(join(segDir, `${hash}.txt`), narration.text, "utf8");
  await writeFile(join(segDir, `${hash}.ssml`), narration.ssml, "utf8");
  return { scene, hash, scenePath };
}
```

- [ ] **Step 3: Implement `packages/cli/src/commands/script-consume.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { StateMachine } from "../state/machine.js";
import { consumeSegmentResults } from "../script/consume.js";
import { formatScriptMarkdown } from "../script/format.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import type { Plan } from "../plan/types.js";
import type { SceneJson } from "../script/types.js";

export interface ScriptConsumeCommandOpts { cwd: string; printMarkdown?: boolean; }

async function readLatestPlan(planDir: string): Promise<Plan> {
  const entries = await readdir(planDir);
  const target = join(planDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as Plan;
}

export async function scriptConsumeCommand(opts: ScriptConsumeCommandOpts): Promise<number> {
  let config;
  try { config = await loadConfig(opts.cwd); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-consume"))); return 1; }
  const paths = cachePaths(opts.cwd);
  const sm = new StateMachine(opts.cwd);
  await sm.load();
  await sm.recordCommand("script-consume");

  let plan: Plan;
  try { plan = await readLatestPlan(join(paths.cache, "plan")); }
  catch (err) { process.stderr.write(renderError(formatError(err, "script-consume"))); return 1; }

  const scenes: SceneJson[] = [];
  for (const segment of plan.segments) {
    try {
      const r = await consumeSegmentResults({ segment, cacheRoot: paths.cache });
      scenes.push(r.scene);
      await sm.markSegmentStage(segment.id, "script", "ok");
    } catch (err) {
      await sm.markSegmentStage(segment.id, "script", "failed", (err as Error).message);
      process.stderr.write(renderError(formatError(err, "script-consume")));
      return 1;
    }
  }
  await sm.markStageComplete("script");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatScriptMarkdown(scenes) + "\n");
  }
  void config;
  logger.info({ segments: scenes.length }, "script-consume complete");
  return 0;
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test script/consume
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script/consume.ts packages/cli/src/commands/script-consume.ts packages/cli/tests/script/consume.test.ts
git commit -m "feat(script): script-consume reads result files + persists scene.json (skill-driven flow)"
```

---

## Task 4: Refactor `tutorialvid script` to dispatcher (with --standalone fallback)

**Files:**
- Modify: `packages/cli/src/commands/script.ts`
- Modify: `packages/cli/src/index.ts` — register script-prepare + script-consume + add --standalone flag to script

- [ ] **Step 1: Refactor `packages/cli/src/commands/script.ts`**

Read current contents first. Add a `--standalone` flag handling. Default behaviour (no flag) should print a helpful message pointing the user at the skill flow, OR detect if work/result files already exist and chain prepare → exit-with-skill-instructions → consume.

Concrete refactor — keep the original `scriptCommand` as `scriptStandaloneCommand` (Anthropic SDK path), add a new dispatcher:

```typescript
import { scriptPrepareCommand } from "./script-prepare.js";
import { scriptConsumeCommand } from "./script-consume.js";

export interface ScriptCommandOpts {
  cwd: string;
  pluginRoot?: string;
  printMarkdown?: boolean;
  standalone?: boolean;
}

// Original Anthropic-SDK orchestrator renamed
export async function scriptStandaloneCommand(opts: ScriptCommandOpts): Promise<number> {
  // ... (keep original body of scriptCommand verbatim)
}

export async function scriptCommand(opts: ScriptCommandOpts): Promise<number> {
  if (opts.standalone) return scriptStandaloneCommand(opts);
  // Default: prepare phase only. Skill is responsible for dispatching subagents
  // and then calling `tutorialvid script-consume`.
  process.stdout.write(
    `\nRunning script-prepare. To complete the script stage:\n` +
    `  1. Read each ${opts.cwd}/.tutorialvid/cache/script/_work/<segment>.<role>.json\n` +
    `  2. Dispatch the named agent (subagent_type) with the system_prompt + user_payload\n` +
    `  3. Save each LLM JSON output to .tutorialvid/cache/script/_result/<segment>.<role>.json\n` +
    `  4. Run \`tutorialvid script-consume --cwd ${opts.cwd}\`\n\n` +
    `Or use --standalone to call Anthropic SDK directly (requires ANTHROPIC_API_KEY).\n\n`
  );
  return scriptPrepareCommand({ cwd: opts.cwd, ...(opts.pluginRoot ? { pluginRoot: opts.pluginRoot } : {}) });
}
```

- [ ] **Step 2: Update `packages/cli/src/index.ts`**

Update the existing `script` command and register two new ones:

```typescript
program
  .command("script")
  .description("Prepare per-segment work files for skill-driven Claude Code subagent dispatch")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .option("--no-markdown", "suppress markdown output")
  .option("--standalone", "use Anthropic SDK directly instead of skill dispatch (requires ANTHROPIC_API_KEY)")
  .action(async (opts) => {
    const { scriptCommand } = await import("./commands/script.js");
    const code = await scriptCommand({ cwd: opts.cwd, pluginRoot: opts.pluginRoot, printMarkdown: opts.markdown !== false, standalone: !!opts.standalone });
    process.exit(code);
  });

program
  .command("script-prepare")
  .description("Emit per-segment work files for skill subagent dispatch")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .action(async (opts) => {
    const { scriptPrepareCommand } = await import("./commands/script-prepare.js");
    const code = await scriptPrepareCommand({ cwd: opts.cwd, pluginRoot: opts.pluginRoot });
    process.exit(code);
  });

program
  .command("script-consume")
  .description("Read subagent result files + persist scene.json/txt/ssml")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--no-markdown", "suppress Gate 2 markdown")
  .action(async (opts) => {
    const { scriptConsumeCommand } = await import("./commands/script-consume.js");
    const code = await scriptConsumeCommand({ cwd: opts.cwd, printMarkdown: opts.markdown !== false });
    process.exit(code);
  });
```

- [ ] **Step 3: Build + run all tests**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
```

Expected: 130+ tests pass (124 prior + ~6 new from work-io, prepare, consume). Build clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/commands/script.ts packages/cli/src/index.ts
git commit -m "feat(cli): script command becomes dispatcher (skill-driven by default, --standalone for SDK)"
```

---

## Task 5: Skill SKILL.md update — drive prepare → dispatch → consume loop

**Files:**
- Modify: `packages/plugin/skills/tutorialvid-create/SKILL.md`

- [ ] **Step 1: Replace the "Script — Gate 2" bullet** in the Capability section

Find the existing line:

```markdown
3. **Script — Gate 2**: `tutorialvid script --cwd <root>` — needs `ANTHROPIC_API_KEY`. Per-segment narration + scene.json via subagents.
```

Replace with:

```markdown
3. **Script — Gate 2**: skill-driven dispatch (no `ANTHROPIC_API_KEY` required when running inside Claude Code).

   Loop:
   1. Run `tutorialvid script-prepare --cwd <root>`. CLI emits `.tutorialvid/cache/script/_work/<segment>.<role>.json` files.
   2. For each work file, dispatch a Task subagent:
      - Read the work file's `agent_name` (e.g. `tutorialvid-script-writer`)
      - Use `subagent_type: <agent_name>` with the work file's `system_prompt` baked into the agent definition
      - Pass the work file's `user_payload` as the prompt content
      - Capture the subagent's JSON-only response and save it as `.tutorialvid/cache/script/_result/<segment>.<role>.json`
   3. Run the writer for all segments first, then the director (director needs the writer's narration result).
   4. Run `tutorialvid script-consume --cwd <root>`. CLI validates each result, writes scene.json + txt + ssml, prints Gate 2 markdown.

   For headless / standalone use (CI, no Claude Code session): `tutorialvid script --standalone --cwd <root>` requires `ANTHROPIC_API_KEY` and uses the Anthropic SDK directly.
```

Update prerequisites to remove the `ANTHROPIC_API_KEY` blanket requirement — make it conditional on `--standalone`.

- [ ] **Step 2: Bump plugin version to 1.1.0**

In `packages/plugin/.claude-plugin/plugin.json` and `packages/plugin/package.json`: `"version": "1.0.0"` → `"version": "1.1.0"`.

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin
git commit -m "docs(plugin): SKILL.md drives prepare→dispatch→consume loop; standalone is fallback"
```

---

## Task 6: Manual checklist + tag v0.1.1-plan6

- [ ] **Step 1: Append to `docs/manual-test-checklist.md`**

```markdown

## Plan 6 acceptance: Claude Code subagent dispatch for script stage

- [ ] `tutorialvid script-prepare --cwd <root>` writes `cache/script/_work/<segment>.{writer,director}.json` files.
- [ ] Each work file contains `agent_name`, `system_prompt`, `user_payload`.
- [ ] Skill loop: dispatch writer Task subagents per segment → save outputs to `_result/<segment>.writer.json` → dispatch director subagents (consuming writer results) → save outputs to `_result/<segment>.director.json`.
- [ ] `tutorialvid script-consume --cwd <root>` validates each result, writes `cache/script/<segment>/<hash>.scene.json/txt/ssml`, prints Gate 2 markdown.
- [ ] Default `tutorialvid script` (no flag) inside Claude Code: works without `ANTHROPIC_API_KEY`.
- [ ] `tutorialvid script --standalone` falls back to Anthropic SDK and requires `ANTHROPIC_API_KEY`.
- [ ] Both modes produce identical scene.json structure for the same plan + same LLM model.
```

- [ ] **Step 2: Append vault close-out** to `Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md`:

```markdown

## Plan 6 shipped — 2026-05-02 — Claude Code subagent dispatch

6 tasks. Tag `v0.1.1-plan6`. Plugin v1.1.0.

### What changed
- Script stage no longer requires a separate `ANTHROPIC_API_KEY` when run from inside Claude Code.
- New CLI commands: `script-prepare` (emit work files) + `script-consume` (read result files + persist).
- Skill orchestrates Task subagent dispatch between prepare and consume.
- `tutorialvid script --standalone` keeps the Anthropic SDK path for CI / headless use.
- No regression: 124 existing tests still pass; ~6 new tests for work-io + prepare + consume.

### Why this matters
Vibe coder using Claude Code already pays for Anthropic via the subscription. Forcing a second `ANTHROPIC_API_KEY` for the script stage doubled their bill and added friction. Plan 6 inverts: skill is the LLM dispatcher inside Claude Code; CLI is purely engine.
```

- [ ] **Step 3: Commit + tag**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add docs/manual-test-checklist.md Vault/
git commit -m "docs: Plan 6 checklist + vault close-out"
git tag -a v0.1.1-plan6 -m "Plan 6 complete: Claude Code subagent dispatch for script stage"
```

- [ ] **Step 4: Final verification**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && git tag -l
```

Expected: ~130 tests pass. Build clean. 6 tags including `v0.1.1-plan6`.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 6 closes the architecture gap surfaced post-Plan-5: script stage was forcing `ANTHROPIC_API_KEY` even when run from inside Claude Code. Now:
- Default flow (skill-driven) needs no extra Anthropic key — uses Claude Code session auth via Task subagents.
- `--standalone` flag preserves the original SDK path for CI / headless use.

**Placeholder scan** — none. Each new module has tests; orchestrator paths reuse existing scene.json types verbatim.

**Type consistency** — `Narration`, `SceneAction`, `SceneJson` types unchanged. New `WorkFile` type is local to work-io and consumed only by prepare + skill (which doesn't enforce TS). New `consume` returns the same `SceneJson` as the original orchestrator.

**Architecture decision (locked)**:
- Skill = LLM dispatcher when inside Claude Code session. CLI provides engine-only `script-prepare` + `script-consume`.
- `--standalone` = fallback for CI / headless / non-Claude-Code environments. Uses original Anthropic SDK + key.
- Director payload references `narration_result_file` so the skill knows the dispatch order (writer first, director after).

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-6-claude-code-subagents.md`.**

Recommend Subagent-Driven execution.
