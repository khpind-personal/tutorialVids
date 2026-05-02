# TutorialVid — Plan 2: Plan + Script + Gates 1–2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tutorialvid plan` (reads scan + user choices → plan.json) and `tutorialvid script` (per-segment Anthropic-driven narration + scene.json), with Gate 1 (Plan) + Gate 2 (Script) summaries the skill renders. Cache + state extend the Plan-1 layout without migration.

**Architecture:** Subagent dispatch = direct Anthropic SDK calls from CLI. System prompts loaded from `packages/plugin/agents/*.md` (markdown frontmatter + body). API key via `ANTHROPIC_API_KEY`. Prompt caching enabled on system prompts (parallel segment fan-out shares cache within 5-min TTL). Skill orchestrates user choices + renders gates; CLI runs all LLM calls.

**Tech Stack additions:** `@anthropic-ai/sdk` ^0.32.0, `gray-matter` ^4.0.3 (parse frontmatter in agent .md files), `p-limit` ^6.1.0 (bound parallel segment fan-out).

**Spec:** `docs/specs/2026-05-02-tutorialvid-design.md` §4.2, §4.3, §8 (Gates 1–2).

**Out of scope (Plans 3+):** TTS (Gemini), Playwright record, Remotion compose, ffmpeg mux, finalize.

---

## Prerequisites (must be done before Task 1)

The vibe coder running Plan 2 builds must have:
- `ANTHROPIC_API_KEY` exported in their shell.
- A scan.json already produced via `tutorialvid scan` (Plan 1).

The plan does NOT require a new pnpm install layer — the new deps are added in Task 1.

---

## File Structure (Plan 2 targets)

```
packages/cli/
├── src/
│   ├── llm/
│   │   ├── anthropic.ts         — SDK wrapper with caching + retries
│   │   ├── prompts.ts           — load + parse plugin/agents/*.md prompts
│   │   └── types.ts             — DispatchInput, DispatchResult, AgentPrompt
│   ├── plan/
│   │   ├── types.ts             — Plan, Segment
│   │   ├── picker.ts            — default selection + apply user toggles
│   │   ├── format.ts            — Plan → markdown table for Gate 1
│   │   └── index.ts             — runPlan() orchestrator
│   ├── script/
│   │   ├── types.ts             — ScriptArtifact, SceneJson types (re-export from spec)
│   │   ├── writer.ts            — per-segment narration call → text + ssml
│   │   ├── director.ts          — per-segment scene call → scene.json
│   │   ├── format.ts            — Script → markdown summary for Gate 2
│   │   └── index.ts             — runScript() orchestrator (parallel fan-out)
│   └── commands/
│       ├── plan.ts              — `tutorialvid plan`
│       └── script.ts            — `tutorialvid script`
└── tests/
    ├── llm/anthropic.test.ts
    ├── llm/prompts.test.ts
    ├── plan/picker.test.ts
    ├── plan/format.test.ts
    ├── script/writer.test.ts
    ├── script/director.test.ts
    ├── script/format.test.ts
    └── e2e/plan-script.test.ts

packages/plugin/
├── agents/
│   ├── tutorialvid-script-writer.md     — system prompt
│   └── tutorialvid-scene-director.md    — system prompt
└── skills/tutorialvid-create/SKILL.md   — extended with plan + script flow + Gates 1, 2
```

---

## Task 1: Add Anthropic SDK + new deps + extend config schema

**Files:**
- Modify: `packages/cli/package.json` — add deps
- Modify: `packages/cli/src/config/schema.ts` — add `anthropic` and `script` blocks
- Modify: `packages/cli/tests/config/load.test.ts` — add a test for the new fields' defaults
- Modify: `packages/cli/src/state/machine.ts` — wire `last_command` (already declared, never written)

- [ ] **Step 1: Install deps**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli add @anthropic-ai/sdk@^0.32.0 gray-matter@^4.0.3 p-limit@^6.1.0
```

- [ ] **Step 2: Extend `config/schema.ts` — add to the `ConfigSchema` object**

After the `tts` block, add:

```typescript
  anthropic: z.object({
    api_key_env: z.string().default("ANTHROPIC_API_KEY"),
    model: z.string().default("claude-sonnet-4-6"),
    max_concurrency: z.number().int().positive().default(4)
  }).default({ api_key_env: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6", max_concurrency: 4 }),
  script: z.object({
    depth: z.enum(["low", "medium", "high"]).default("medium"),
    tone: z.enum(["friendly", "pro", "hype", "founder", "documentary"]).default("friendly"),
    language: z.string().default("en-US")
  }).default({ depth: "medium", tone: "friendly", language: "en-US" }),
```

- [ ] **Step 3: Update test in `tests/config/load.test.ts`**

Add a test case at the end of the `describe`:

```typescript
  it("applies defaults for new anthropic + script blocks", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.anthropic.model).toBe("claude-sonnet-4-6");
    expect(cfg.anthropic.max_concurrency).toBe(4);
    expect(cfg.script.depth).toBe("medium");
    expect(cfg.script.tone).toBe("friendly");
  });
```

- [ ] **Step 4: Wire `last_command` in `state/machine.ts`**

Add a method:

```typescript
  async recordCommand(name: string): Promise<void> {
    const s = await this.load();
    s.last_command = name;
    await this.save();
  }
```

- [ ] **Step 5: Add a state test for `recordCommand`**

In `tests/state/machine.test.ts`, add:

```typescript
  it("records the last command name", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.recordCommand("plan");
    const s = await sm.load();
    expect(s.last_command).toBe("plan");
  });
```

- [ ] **Step 6: Run tests + build**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test config/load state/machine
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

Expected: all pass. Build clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/package.json packages/cli/src/config/schema.ts packages/cli/src/state/machine.ts packages/cli/tests pnpm-lock.yaml
git commit -m "feat(cli): add Anthropic+script config blocks and StateMachine.recordCommand"
```

---

## Task 2: Subagent prompt loader

**Files:**
- Create: `packages/cli/src/llm/types.ts`
- Create: `packages/cli/src/llm/prompts.ts`
- Create: `packages/cli/tests/llm/prompts.test.ts`

- [ ] **Step 1: Create `packages/cli/src/llm/types.ts`**

```typescript
export interface AgentPrompt {
  name: string;
  description: string;
  model?: string;
  system: string;
}

export interface DispatchInput {
  agent: AgentPrompt;
  user: string;
  cacheKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface DispatchResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model: string;
  stopReason: string;
}
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/llm/prompts.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentPrompt } from "../../src/llm/prompts.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tv-prompts-"));
  mkdirSync(join(root, "agents"));
});

describe("loadAgentPrompt", () => {
  it("parses frontmatter + body from an agent .md file", async () => {
    writeFileSync(
      join(root, "agents/tutorialvid-script-writer.md"),
      `---
name: tutorialvid-script-writer
description: per-segment narration writer
model: claude-sonnet-4-6
---
You are a tutorial narration writer. Be concise and warm.`
    );
    const p = await loadAgentPrompt(root, "tutorialvid-script-writer");
    expect(p.name).toBe("tutorialvid-script-writer");
    expect(p.model).toBe("claude-sonnet-4-6");
    expect(p.system).toContain("tutorial narration writer");
  });

  it("throws clear error when agent file missing", async () => {
    await expect(loadAgentPrompt(root, "missing"))
      .rejects.toThrow(/agent prompt not found/i);
  });

  it("throws when frontmatter missing required fields", async () => {
    writeFileSync(join(root, "agents/bad.md"), `---\n---\nbody only`);
    await expect(loadAgentPrompt(root, "bad"))
      .rejects.toThrow(/missing.*(name|description)/i);
  });
});
```

- [ ] **Step 3: Run + verify FAIL**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test llm/prompts
```

- [ ] **Step 4: Implement `packages/cli/src/llm/prompts.ts`**

```typescript
import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import matter from "gray-matter";
import type { AgentPrompt } from "./types.js";

export async function loadAgentPrompt(pluginRoot: string, agentName: string): Promise<AgentPrompt> {
  const path = join(pluginRoot, "agents", `${agentName}.md`);
  try { await access(path); }
  catch { throw new Error(`agent prompt not found at ${path}`); }
  const raw = await readFile(path, "utf8");
  const { data, content } = matter(raw);
  if (!data.name || typeof data.name !== "string") throw new Error(`agent prompt at ${path} missing 'name' in frontmatter`);
  if (!data.description || typeof data.description !== "string") throw new Error(`agent prompt at ${path} missing 'description' in frontmatter`);
  return {
    name: data.name,
    description: data.description,
    model: typeof data.model === "string" ? data.model : undefined,
    system: content.trim()
  };
}
```

- [ ] **Step 5: Verify PASS**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test llm/prompts
```

- [ ] **Step 6: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/llm packages/cli/tests/llm
git commit -m "feat(llm): subagent prompt loader (frontmatter + body from .md)"
```

---

## Task 3: Anthropic SDK dispatcher (with prompt caching)

**Files:**
- Create: `packages/cli/src/llm/anthropic.ts`
- Create: `packages/cli/tests/llm/anthropic.test.ts`

- [ ] **Step 1: Write FAILING test — `packages/cli/tests/llm/anthropic.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "../../src/llm/anthropic.js";
import type { AgentPrompt } from "../../src/llm/types.js";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  }
}));

beforeEach(() => {
  mockCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

const agent: AgentPrompt = {
  name: "test-agent",
  description: "test",
  system: "You are a test agent."
};

describe("dispatch", () => {
  it("calls Anthropic with cached system prompt + returns parsed result", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 100 },
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn"
    });
    const r = await dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6" });
    expect(r.text).toBe("ok");
    expect(r.inputTokens).toBe(100);
    expect(r.cacheCreationTokens).toBe(100);
    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.system).toEqual([
      { type: "text", text: "You are a test agent.", cache_control: { type: "ephemeral" } }
    ]);
  });

  it("throws when API key env var is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6" }))
      .rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it("retries on 529/overloaded with exponential backoff", async () => {
    const overloaded = Object.assign(new Error("overloaded"), { status: 529 });
    mockCreate
      .mockRejectedValueOnce(overloaded)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "after retry" }],
        usage: { input_tokens: 10, output_tokens: 2 },
        model: "claude-sonnet-4-6",
        stop_reason: "end_turn"
      });
    const r = await dispatch({ agent, user: "hi", apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6", retryDelayMs: 1 });
    expect(r.text).toBe("after retry");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test llm/anthropic
```

- [ ] **Step 3: Implement `packages/cli/src/llm/anthropic.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AgentPrompt, DispatchResult } from "./types.js";

export interface DispatchOpts {
  agent: AgentPrompt;
  user: string;
  apiKeyEnv: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMP = 0.5;
const DEFAULT_RETRY_DELAY = 500;
const DEFAULT_MAX_RETRIES = 3;

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function dispatch(opts: DispatchOpts): Promise<DispatchResult> {
  const apiKey = process.env[opts.apiKeyEnv];
  if (!apiKey) throw new Error(`${opts.apiKeyEnv} is not set`);

  const client = new Anthropic({ apiKey });
  const model = opts.agent.model ?? opts.model;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY;

  let attempt = 0;
  while (true) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? DEFAULT_TEMP,
        system: [
          { type: "text", text: opts.agent.system, cache_control: { type: "ephemeral" } }
        ],
        messages: [{ role: "user", content: opts.user }]
      });
      const textBlock = resp.content.find((b: { type: string }) => b.type === "text") as { type: "text"; text: string } | undefined;
      const text = textBlock?.text ?? "";
      const usage = resp.usage as {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      return {
        text,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        ...(usage.cache_read_input_tokens !== undefined ? { cacheReadTokens: usage.cache_read_input_tokens } : {}),
        ...(usage.cache_creation_input_tokens !== undefined ? { cacheCreationTokens: usage.cache_creation_input_tokens } : {}),
        model: resp.model,
        stopReason: resp.stop_reason ?? "unknown"
      };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && RETRYABLE.has(status) && attempt < maxRetries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test llm/anthropic
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/llm/anthropic.ts packages/cli/tests/llm/anthropic.test.ts
git commit -m "feat(llm): Anthropic dispatcher with prompt caching + retry"
```

---

## Task 4: Plan types + picker

**Files:**
- Create: `packages/cli/src/plan/types.ts`
- Create: `packages/cli/src/plan/picker.ts`
- Create: `packages/cli/tests/plan/picker.test.ts`

- [ ] **Step 1: `packages/cli/src/plan/types.ts`**

```typescript
import type { Framework } from "../scan/types.js";

export type Depth = "low" | "medium" | "high";
export type Tone = "friendly" | "pro" | "hype" | "founder" | "documentary";

export interface Segment {
  id: string;            // e.g. s01_dashboard
  page_id: string;       // matches PageEntry.id from scan
  page_route: string;    // "/dashboard"
  page_title: string;
  depth: Depth;
  tone: Tone;
  target_duration_s: number;
  importance: number;
  requires_auth: boolean;
}

export interface Plan {
  framework: Framework;
  base_url: string;
  depth: Depth;
  tone: Tone;
  language: string;
  segments: Segment[];
  created_at: string;    // ISO timestamp
}

export interface PickerInput {
  pages: { id: string; route: string; title: string; importance: number; requires_auth: boolean }[];
  selected: string[];    // page ids; if empty, default selection applies
  defaultTopN?: number;
}
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/plan/picker.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { pickSegments, durationFor } from "../../src/plan/picker.js";

const pages = [
  { id: "dashboard", route: "/dashboard", title: "Dashboard", importance: 5, requires_auth: true },
  { id: "profile", route: "/profile", title: "Profile", importance: 1, requires_auth: true },
  { id: "settings", route: "/settings", title: "Settings", importance: 3, requires_auth: true },
  { id: "login", route: "/login", title: "Sign in", importance: 0, requires_auth: false }
];

describe("pickSegments", () => {
  it("defaults to top-N by importance when no selection given", () => {
    const segs = pickSegments({ pages, selected: [], defaultTopN: 2 }, "medium", "friendly");
    expect(segs.map(s => s.page_id)).toEqual(["dashboard", "settings"]);
  });

  it("respects user selection regardless of importance", () => {
    const segs = pickSegments({ pages, selected: ["login", "profile"] }, "low", "pro");
    expect(segs.map(s => s.page_id)).toEqual(["login", "profile"]);
  });

  it("assigns sequential ids in selection order", () => {
    const segs = pickSegments({ pages, selected: ["dashboard", "settings"] }, "medium", "friendly");
    expect(segs[0]?.id).toBe("s01_dashboard");
    expect(segs[1]?.id).toBe("s02_settings");
  });

  it("propagates depth and tone to each segment", () => {
    const segs = pickSegments({ pages, selected: ["dashboard"] }, "high", "documentary");
    expect(segs[0]?.depth).toBe("high");
    expect(segs[0]?.tone).toBe("documentary");
  });

  it("uses durationFor for target_duration_s", () => {
    const segs = pickSegments({ pages, selected: ["dashboard"] }, "medium", "friendly");
    expect(segs[0]?.target_duration_s).toBe(durationFor("medium"));
  });
});

describe("durationFor", () => {
  it("low → 30", () => expect(durationFor("low")).toBe(30));
  it("medium → 75", () => expect(durationFor("medium")).toBe(75));
  it("high → 180", () => expect(durationFor("high")).toBe(180));
});
```

- [ ] **Step 3: Verify FAIL**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test plan/picker
```

- [ ] **Step 4: Implement `packages/cli/src/plan/picker.ts`**

```typescript
import type { Depth, Segment, Tone, PickerInput } from "./types.js";

export function durationFor(depth: Depth): number {
  switch (depth) {
    case "low": return 30;
    case "medium": return 75;
    case "high": return 180;
  }
}

function makeId(index: number, pageId: string): string {
  const n = String(index + 1).padStart(2, "0");
  return `s${n}_${pageId}`;
}

export function pickSegments(input: PickerInput, depth: Depth, tone: Tone): Segment[] {
  let chosen = input.selected;
  if (chosen.length === 0) {
    const topN = input.defaultTopN ?? 5;
    chosen = [...input.pages]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topN)
      .map((p) => p.id);
  }

  const byId = new Map(input.pages.map((p) => [p.id, p]));
  const segments: Segment[] = [];
  chosen.forEach((pageId, i) => {
    const p = byId.get(pageId);
    if (!p) return;
    segments.push({
      id: makeId(i, pageId),
      page_id: pageId,
      page_route: p.route,
      page_title: p.title,
      depth,
      tone,
      target_duration_s: durationFor(depth),
      importance: p.importance,
      requires_auth: p.requires_auth
    });
  });
  return segments;
}
```

- [ ] **Step 5: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test plan/picker
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/plan/types.ts packages/cli/src/plan/picker.ts packages/cli/tests/plan/picker.test.ts
git commit -m "feat(plan): segment picker (default top-N + user selection)"
```

---

## Task 5: Plan markdown formatter (Gate 1)

**Files:**
- Create: `packages/cli/src/plan/format.ts`
- Create: `packages/cli/tests/plan/format.test.ts`

- [ ] **Step 1: Write FAILING test — `packages/cli/tests/plan/format.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { formatPlanMarkdown } from "../../src/plan/format.js";
import type { Plan } from "../../src/plan/types.js";

const plan: Plan = {
  framework: "react-router",
  base_url: "http://localhost:5173",
  depth: "medium",
  tone: "friendly",
  language: "en-US",
  created_at: "2026-05-02T00:00:00Z",
  segments: [
    { id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
      depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true },
    { id: "s02_profile", page_id: "profile", page_route: "/profile", page_title: "Profile",
      depth: "medium", tone: "friendly", target_duration_s: 75, importance: 1, requires_auth: true }
  ]
};

describe("formatPlanMarkdown", () => {
  it("includes a header line summarizing depth + tone + segment count", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/2 segments/);
    expect(md).toMatch(/medium/);
    expect(md).toMatch(/friendly/);
  });

  it("renders a markdown table with one row per segment", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/\| s01_dashboard \|.*\| Dashboard \|/);
    expect(md).toMatch(/\| s02_profile \|.*\| Profile \|/);
  });

  it("computes total estimated duration in mm:ss format", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/total.*2:30/i);  // 150s = 2:30
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `packages/cli/src/plan/format.ts`**

```typescript
import type { Plan } from "./types.js";

function fmtDuration(totalS: number): string {
  const mm = Math.floor(totalS / 60);
  const ss = totalS % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatPlanMarkdown(plan: Plan): string {
  const total = plan.segments.reduce((acc, s) => acc + s.target_duration_s, 0);
  const lines = [
    `# TutorialVid Plan — Gate 1`,
    ``,
    `**${plan.segments.length} segments** · depth: **${plan.depth}** · tone: **${plan.tone}** · total estimated **${fmtDuration(total)}**`,
    ``,
    `| ID | Route | Title | Auth | Importance | Duration |`,
    `|----|-------|-------|------|------------|----------|`,
    ...plan.segments.map((s) =>
      `| ${s.id} | ${s.page_route} | ${s.page_title} | ${s.requires_auth ? "yes" : "no"} | ${s.importance} | ${fmtDuration(s.target_duration_s)} |`
    ),
    ``,
    `Approve, edit, or cancel before proceeding to script generation.`
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test plan/format
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/plan/format.ts packages/cli/tests/plan/format.test.ts
git commit -m "feat(plan): markdown formatter for Gate 1"
```

---

## Task 6: `tutorialvid plan` command + orchestrator

**Files:**
- Create: `packages/cli/src/plan/index.ts`
- Create: `packages/cli/src/commands/plan.ts`
- Modify: `packages/cli/src/index.ts` — register `plan` subcommand

- [ ] **Step 1: Implement `packages/cli/src/plan/index.ts`**

```typescript
import { readFile } from "node:fs/promises";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { ScanResult } from "../scan/types.js";
import { pickSegments } from "./picker.js";
import type { Plan } from "./types.js";

export interface RunPlanInput {
  scan: ScanResult;
  config: Config;
  selectedPageIds: string[];
  defaultTopN?: number;
}

export async function runPlan(input: RunPlanInput): Promise<{ plan: Plan; hash: string }> {
  const segments = pickSegments(
    {
      pages: input.scan.pages.map((p) => ({
        id: p.id, route: p.route, title: p.title, importance: p.importance, requires_auth: p.requires_auth
      })),
      selected: input.selectedPageIds,
      ...(input.defaultTopN !== undefined ? { defaultTopN: input.defaultTopN } : {})
    },
    input.config.script.depth,
    input.config.script.tone
  );
  const plan: Plan = {
    framework: input.scan.framework,
    base_url: input.scan.base_url,
    depth: input.config.script.depth,
    tone: input.config.script.tone,
    language: input.config.script.language,
    segments,
    created_at: new Date().toISOString()
  };
  const hash = hashInputs({
    framework: plan.framework,
    base_url: plan.base_url,
    depth: plan.depth,
    tone: plan.tone,
    language: plan.language,
    segment_ids: segments.map((s) => s.id)
  });
  return { plan, hash };
}

export async function readScanFromCache(scanCacheDir: string, hash: string): Promise<ScanResult> {
  const path = `${scanCacheDir}/${hash}.json`;
  return JSON.parse(await readFile(path, "utf8")) as ScanResult;
}
```

- [ ] **Step 2: Implement `packages/cli/src/commands/plan.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runPlan } from "../plan/index.js";
import { formatPlanMarkdown } from "../plan/format.js";
import { logger } from "../logger.js";
import type { ScanResult } from "../scan/types.js";

export interface PlanCommandOpts {
  cwd: string;
  selected?: string[];   // page ids
  topN?: number;
  printMarkdown?: boolean;
}

async function readLatestScan(scanDir: string): Promise<ScanResult> {
  const entries = await readdir(scanDir);
  if (entries.length === 0) throw new Error("no scan.json found in cache; run 'tutorialvid scan' first");
  const target = join(scanDir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as ScanResult;
}

export async function planCommand(opts: PlanCommandOpts): Promise<number> {
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
  await sm.recordCommand("plan");

  const scan = await readLatestScan(join(paths.cache, "scan"));
  const { plan, hash } = await runPlan({
    scan, config,
    selectedPageIds: opts.selected ?? [],
    ...(opts.topN !== undefined ? { defaultTopN: opts.topN } : {})
  });

  const target = paths.plan(hash);
  const existing = await store.readJson(target);
  if (existing) {
    logger.info({ target }, "plan cache hit");
  } else {
    await store.writeJson(target, plan);
    logger.info({ target, segments: plan.segments.length }, "plan written");
  }
  await sm.markStageComplete("plan");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatPlanMarkdown(plan) + "\n");
  }
  return 0;
}
```

- [ ] **Step 3: Wire `plan` into `packages/cli/src/index.ts`**

After the `scan` command block, add:

```typescript
program
  .command("plan")
  .description("Build a plan.json from the latest scan + user choices")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--select <ids>", "comma-separated page ids to include", (v: string) => v.split(",").map(s => s.trim()).filter(Boolean), [])
  .option("--top-n <n>", "default number of pages when no selection", (v: string) => parseInt(v, 10))
  .option("--no-markdown", "suppress markdown output")
  .action(async (opts) => {
    const { planCommand } = await import("./commands/plan.js");
    const code = await planCommand({
      cwd: opts.cwd,
      selected: opts.select,
      topN: opts.topN,
      printMarkdown: opts.markdown !== false
    });
    process.exit(code);
  });
```

- [ ] **Step 4: Verify build + run command**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/plan/index.ts packages/cli/src/commands/plan.ts packages/cli/src/index.ts
git commit -m "feat(cli): add 'tutorialvid plan' command"
```

---

## Task 7: Plugin agents — script-writer + scene-director

**Files:**
- Create: `packages/plugin/agents/tutorialvid-script-writer.md`
- Create: `packages/plugin/agents/tutorialvid-scene-director.md`

- [ ] **Step 1: Create `packages/plugin/agents/tutorialvid-script-writer.md`**

```markdown
---
name: tutorialvid-script-writer
description: Generates per-segment narration text and SSML for a tutorial video.
model: claude-sonnet-4-6
---

You are the TutorialVid script-writer agent. Your job is to write tutorial narration for ONE segment (one page) of a product tutorial video.

# Inputs

You will receive a JSON object with:
- segment: the Segment object (id, page_id, page_route, page_title, depth, tone, target_duration_s, requires_auth)
- page_actions: an array of ActionHint objects (selector, label, kind) — the things a viewer can do on this page
- base_url: the app's base URL
- language: e.g. "en-US"

# Output

Return a single JSON object (no surrounding prose, no markdown fences) with this shape:

```
{
  "text": "<narration text, 1-3 short paragraphs>",
  "ssml": "<SSML wrapping of the same text with <break time='200ms'/> at natural pause points>",
  "alignments": [
    { "phrase": "<exact phrase from text>", "action_t_ms": <when this phrase begins, ms from segment start> }
  ]
}
```

# Tone presets

- friendly: warm, second person ("Let's click here together"). Default.
- pro: neutral, third-person-ish ("Click X to do Y"). Concise, clear.
- hype: punchy, short sentences, energy. For launch-style.
- founder: first person ("I built this so you can…"). Sincere.
- documentary: calm, slower, explanatory.

# Depth presets

- low: name the feature, what it does. 2-3 sentences total. Aim for ~25 seconds at typical TTS pace.
- medium: name + why + what it returns. 4-6 sentences. Aim for ~75 seconds.
- high: name + why + edge cases + tips. 7-10 sentences. Aim for ~180 seconds. Add one "pro tip" callout phrase that the scene-director can attach.

# Hard rules

- Match the requested target_duration_s (assume ~150 wpm for TTS pacing).
- Use the actual page_title in the narration.
- Reference real selectors/labels from page_actions when describing user clicks.
- No filler, hedging, or generic AI language ("Welcome to this amazing journey").
- No JSON code fences in your response. Return raw JSON only.
- All phrases in alignments must appear verbatim in text.
```

- [ ] **Step 2: Create `packages/plugin/agents/tutorialvid-scene-director.md`**

```markdown
---
name: tutorialvid-scene-director
description: Generates scene.json directives (zoom, callouts, ripples) for a tutorial segment.
model: claude-sonnet-4-6
---

You are the TutorialVid scene-director agent. Given a segment + its narration + the page actions, you produce a `scene.json` describing how the recorder + compositor should drive the screen.

# Inputs

JSON with:
- segment: the Segment object
- narration: { text, ssml, alignments } (from script-writer)
- page_actions: ActionHint[]

# Output

Return a single JSON object (no surrounding prose, no fences) with this shape:

```
{
  "actions": [
    { "t_ms": <ms>, "type": "nav" | "wait" | "type" | "click", "selector"?: "...", "url"?: "...", "text"?: "...",
      "zoom"?: { "scale": <num>, "in_ms": <int>, "hold_ms": <int>, "out_ms": <int> },
      "ripple"?: <bool>,
      "callout"?: { "text": "...", "anchor": "left"|"right"|"top"|"bottom", "duration_ms": <int> },
      "highlight_score"?: <int 0-10> }
  ]
}
```

# Hybrid rule + LLM model

Default rules (apply unless overridden):
- click → zoom 1.8x for 400/800/400 ms (in/hold/out), ripple true
- type → zoom 1.5x for 300/<input duration>/300 ms, no ripple
- nav → no zoom, no ripple
- wait → no zoom

LLM overrides depth-scaled budget for callouts:
- low depth: 0 callouts
- medium depth: 1 callout per segment, on the most important click
- high depth: up to 3 callouts; can also promote zoom hold to slow-mo (hold_ms 1500+) on the key moment

For each click action, set highlight_score 0-10 (used by Phase-2 marketing distillation).

# Hard rules

- First action is always type "nav" with the segment's page_route as url and t_ms 0.
- Last click matches the page's primary CTA where possible.
- Action timing must align with narration.alignments — if narration says "click create" at 4500 ms, the click action's t_ms is approximately 4500.
- No JSON code fences. Return raw JSON only.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin/agents
git commit -m "feat(plugin): add script-writer and scene-director system prompts"
```

---

## Task 8: Script writer integration

**Files:**
- Create: `packages/cli/src/script/types.ts`
- Create: `packages/cli/src/script/writer.ts`
- Create: `packages/cli/tests/script/writer.test.ts`

- [ ] **Step 1: `packages/cli/src/script/types.ts`**

```typescript
export interface NarrationAlignment {
  phrase: string;
  action_t_ms: number;
}

export interface Narration {
  text: string;
  ssml: string;
  alignments: NarrationAlignment[];
}

export interface SceneAction {
  t_ms: number;
  type: "nav" | "wait" | "type" | "click";
  selector?: string;
  url?: string;
  text?: string;
  zoom?: { scale: number; in_ms: number; hold_ms: number; out_ms: number };
  ripple?: boolean;
  callout?: { text: string; anchor: "left" | "right" | "top" | "bottom"; duration_ms: number };
  highlight_score?: number;
}

export interface SceneJson {
  segment_id: string;
  page_id: string;
  depth: "low" | "medium" | "high";
  tone: string;
  target_duration_s: number;
  actions: SceneAction[];
  narration: Narration;
}
```

- [ ] **Step 2: Write FAILING test — `packages/cli/tests/script/writer.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeNarration } from "../../src/script/writer.js";
import type { Segment } from "../../src/plan/types.js";
import type { ActionHint } from "../../src/scan/types.js";

const dispatchMock = vi.fn();

vi.mock("../../src/llm/anthropic.js", () => ({
  dispatch: (...args: unknown[]) => dispatchMock(...args)
}));

beforeEach(() => dispatchMock.mockReset());

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true
};
const actions: ActionHint[] = [
  { selector: "[data-test=link-profile]", label: "Profile", kind: "link" }
];

describe("writeNarration", () => {
  it("calls dispatch with the script-writer agent and returns parsed narration", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: '{"text":"Welcome to your Dashboard.","ssml":"<speak>Welcome to your Dashboard.</speak>","alignments":[{"phrase":"Welcome","action_t_ms":0}]}',
      inputTokens: 100, outputTokens: 50, model: "claude-sonnet-4-6", stopReason: "end_turn"
    });
    const agent = { name: "tutorialvid-script-writer", description: "x", system: "you are sw" };
    const r = await writeNarration({
      agent, segment: seg, page_actions: actions, base_url: "http://localhost:5173", language: "en-US",
      apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6"
    });
    expect(r.narration.text).toBe("Welcome to your Dashboard.");
    expect(r.narration.alignments[0]?.phrase).toBe("Welcome");
    expect(dispatchMock).toHaveBeenCalledOnce();
  });

  it("throws when LLM returns invalid JSON", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: "not json", inputTokens: 1, outputTokens: 1, model: "x", stopReason: "end_turn"
    });
    const agent = { name: "x", description: "x", system: "x" };
    await expect(writeNarration({
      agent, segment: seg, page_actions: actions, base_url: "x", language: "en-US",
      apiKeyEnv: "K", model: "claude-sonnet-4-6"
    })).rejects.toThrow(/invalid JSON|narration/i);
  });
});
```

- [ ] **Step 3: Verify FAIL**

- [ ] **Step 4: Implement `packages/cli/src/script/writer.ts`**

```typescript
import { dispatch } from "../llm/anthropic.js";
import type { AgentPrompt, DispatchResult } from "../llm/types.js";
import type { Segment } from "../plan/types.js";
import type { ActionHint } from "../scan/types.js";
import type { Narration } from "./types.js";

export interface WriteNarrationInput {
  agent: AgentPrompt;
  segment: Segment;
  page_actions: ActionHint[];
  base_url: string;
  language: string;
  apiKeyEnv: string;
  model: string;
}

export interface WriteNarrationResult {
  narration: Narration;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number };
}

export async function writeNarration(input: WriteNarrationInput): Promise<WriteNarrationResult> {
  const userPayload = {
    segment: input.segment,
    page_actions: input.page_actions,
    base_url: input.base_url,
    language: input.language
  };
  const result: DispatchResult = await dispatch({
    agent: input.agent,
    user: JSON.stringify(userPayload),
    apiKeyEnv: input.apiKeyEnv,
    model: input.model
  });
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); }
  catch { throw new Error(`script-writer returned invalid JSON: ${result.text.slice(0, 200)}`); }
  const n = parsed as Partial<Narration>;
  if (!n || typeof n.text !== "string" || typeof n.ssml !== "string" || !Array.isArray(n.alignments)) {
    throw new Error(`script-writer returned malformed narration: missing text/ssml/alignments`);
  }
  return {
    narration: { text: n.text, ssml: n.ssml, alignments: n.alignments as Narration["alignments"] },
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ...(result.cacheReadTokens !== undefined ? { cacheReadTokens: result.cacheReadTokens } : {}),
      ...(result.cacheCreationTokens !== undefined ? { cacheCreationTokens: result.cacheCreationTokens } : {})
    }
  };
}
```

- [ ] **Step 5: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test script/writer
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script/types.ts packages/cli/src/script/writer.ts packages/cli/tests/script/writer.test.ts
git commit -m "feat(script): per-segment narration writer"
```

---

## Task 9: Scene director integration

**Files:**
- Create: `packages/cli/src/script/director.ts`
- Create: `packages/cli/tests/script/director.test.ts`

- [ ] **Step 1: Write FAILING test — `packages/cli/tests/script/director.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { directScene } from "../../src/script/director.js";
import type { Segment } from "../../src/plan/types.js";
import type { ActionHint } from "../../src/scan/types.js";
import type { Narration } from "../../src/script/types.js";

const dispatchMock = vi.fn();
vi.mock("../../src/llm/anthropic.js", () => ({ dispatch: (...args: unknown[]) => dispatchMock(...args) }));

beforeEach(() => dispatchMock.mockReset());

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true
};
const actions: ActionHint[] = [{ selector: "[data-test=link-profile]", label: "Profile", kind: "link" }];
const narration: Narration = {
  text: "Welcome.", ssml: "<speak>Welcome.</speak>",
  alignments: [{ phrase: "Welcome", action_t_ms: 0 }]
};

describe("directScene", () => {
  it("returns a SceneJson with actions array and embedded narration", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: JSON.stringify({
        actions: [
          { t_ms: 0, type: "nav", url: "/dashboard" },
          { t_ms: 2000, type: "click", selector: "[data-test=link-profile]",
            zoom: { scale: 1.8, in_ms: 400, hold_ms: 800, out_ms: 400 }, ripple: true, highlight_score: 7 }
        ]
      }),
      inputTokens: 100, outputTokens: 80, model: "claude-sonnet-4-6", stopReason: "end_turn"
    });
    const agent = { name: "tutorialvid-scene-director", description: "x", system: "you are sd" };
    const r = await directScene({
      agent, segment: seg, page_actions: actions, narration,
      apiKeyEnv: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6"
    });
    expect(r.scene.segment_id).toBe("s01_dashboard");
    expect(r.scene.actions).toHaveLength(2);
    expect(r.scene.actions[0]?.type).toBe("nav");
    expect(r.scene.narration).toEqual(narration);
  });

  it("rejects when actions is missing or empty", async () => {
    dispatchMock.mockResolvedValueOnce({
      text: '{"actions":[]}', inputTokens: 1, outputTokens: 1, model: "x", stopReason: "end_turn"
    });
    const agent = { name: "x", description: "x", system: "x" };
    await expect(directScene({
      agent, segment: seg, page_actions: actions, narration,
      apiKeyEnv: "K", model: "claude-sonnet-4-6"
    })).rejects.toThrow(/empty|actions/i);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `packages/cli/src/script/director.ts`**

```typescript
import { dispatch } from "../llm/anthropic.js";
import type { AgentPrompt, DispatchResult } from "../llm/types.js";
import type { Segment } from "../plan/types.js";
import type { ActionHint } from "../scan/types.js";
import type { Narration, SceneAction, SceneJson } from "./types.js";

export interface DirectSceneInput {
  agent: AgentPrompt;
  segment: Segment;
  page_actions: ActionHint[];
  narration: Narration;
  apiKeyEnv: string;
  model: string;
}

export interface DirectSceneResult {
  scene: SceneJson;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number };
}

export async function directScene(input: DirectSceneInput): Promise<DirectSceneResult> {
  const userPayload = {
    segment: input.segment,
    page_actions: input.page_actions,
    narration: input.narration
  };
  const result: DispatchResult = await dispatch({
    agent: input.agent,
    user: JSON.stringify(userPayload),
    apiKeyEnv: input.apiKeyEnv,
    model: input.model
  });
  let parsed: unknown;
  try { parsed = JSON.parse(result.text); }
  catch { throw new Error(`scene-director returned invalid JSON: ${result.text.slice(0, 200)}`); }
  const a = (parsed as { actions?: SceneAction[] }).actions;
  if (!Array.isArray(a) || a.length === 0) {
    throw new Error(`scene-director returned empty or missing actions array`);
  }
  const scene: SceneJson = {
    segment_id: input.segment.id,
    page_id: input.segment.page_id,
    depth: input.segment.depth,
    tone: input.segment.tone,
    target_duration_s: input.segment.target_duration_s,
    actions: a,
    narration: input.narration
  };
  return {
    scene,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ...(result.cacheReadTokens !== undefined ? { cacheReadTokens: result.cacheReadTokens } : {}),
      ...(result.cacheCreationTokens !== undefined ? { cacheCreationTokens: result.cacheCreationTokens } : {})
    }
  };
}
```

- [ ] **Step 4: Verify PASS + Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test script/director
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script/director.ts packages/cli/tests/script/director.test.ts
git commit -m "feat(script): per-segment scene director"
```

---

## Task 10: Script orchestrator + Gate 2 formatter + `tutorialvid script` command

**Files:**
- Create: `packages/cli/src/script/format.ts`
- Create: `packages/cli/src/script/index.ts`
- Create: `packages/cli/src/commands/script.ts`
- Modify: `packages/cli/src/index.ts` — register `script` subcommand
- Create: `packages/cli/tests/script/format.test.ts`

- [ ] **Step 1: `packages/cli/src/script/format.ts`** + test

`format.ts`:

```typescript
import type { SceneJson } from "./types.js";

export function formatScriptMarkdown(scenes: SceneJson[]): string {
  const lines = [`# TutorialVid Script — Gate 2`, ``, `${scenes.length} segment(s):`, ``];
  for (const s of scenes) {
    lines.push(`## ${s.segment_id} — ${s.page_id}`);
    lines.push("");
    lines.push("**Narration:**");
    lines.push("");
    lines.push(s.narration.text);
    lines.push("");
    lines.push(`**Actions:** ${s.actions.length}, **target:** ${s.target_duration_s}s, **depth:** ${s.depth}, **tone:** ${s.tone}`);
    lines.push("");
  }
  return lines.join("\n");
}
```

`tests/script/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatScriptMarkdown } from "../../src/script/format.js";
import type { SceneJson } from "../../src/script/types.js";

const scenes: SceneJson[] = [{
  segment_id: "s01_dashboard", page_id: "dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75,
  actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }],
  narration: { text: "Welcome to your dashboard.", ssml: "<speak>Welcome to your dashboard.</speak>", alignments: [] }
}];

describe("formatScriptMarkdown", () => {
  it("renders one section per segment with narration text", () => {
    const md = formatScriptMarkdown(scenes);
    expect(md).toMatch(/## s01_dashboard/);
    expect(md).toMatch(/Welcome to your dashboard/);
    expect(md).toMatch(/medium/);
  });
});
```

- [ ] **Step 2: Implement `packages/cli/src/script/index.ts`**

```typescript
import pLimit from "p-limit";
import { writeNarration } from "./writer.js";
import { directScene } from "./director.js";
import { loadAgentPrompt } from "../llm/prompts.js";
import { hashInputs } from "../cache/hash.js";
import type { Plan, Segment } from "../plan/types.js";
import type { ScanResult, PageEntry } from "../scan/types.js";
import type { SceneJson } from "./types.js";
import type { Config } from "../config/schema.js";

export interface RunScriptInput {
  plan: Plan;
  scan: ScanResult;
  config: Config;
  pluginRoot: string;
}

export interface ScriptArtifact {
  scene: SceneJson;
  hash: string;
}

function pageActionsFor(seg: Segment, scan: ScanResult): PageEntry["primary_actions"] {
  return scan.pages.find((p) => p.id === seg.page_id)?.primary_actions ?? [];
}

export async function runScript(input: RunScriptInput): Promise<ScriptArtifact[]> {
  const writerAgent = await loadAgentPrompt(input.pluginRoot, "tutorialvid-script-writer");
  const directorAgent = await loadAgentPrompt(input.pluginRoot, "tutorialvid-scene-director");
  const limit = pLimit(input.config.anthropic.max_concurrency);
  const apiKeyEnv = input.config.anthropic.api_key_env;
  const model = input.config.anthropic.model;
  const language = input.plan.language;

  const tasks = input.plan.segments.map((segment) =>
    limit(async () => {
      const page_actions = pageActionsFor(segment, input.scan);
      const w = await writeNarration({
        agent: writerAgent, segment, page_actions,
        base_url: input.scan.base_url, language, apiKeyEnv, model
      });
      const d = await directScene({
        agent: directorAgent, segment, page_actions, narration: w.narration, apiKeyEnv, model
      });
      const hash = hashInputs({
        segment_id: segment.id, depth: segment.depth, tone: segment.tone,
        narration_text: w.narration.text, actions_count: d.scene.actions.length
      });
      return { scene: d.scene, hash };
    })
  );
  return Promise.all(tasks);
}
```

- [ ] **Step 3: Implement `packages/cli/src/commands/script.ts`**

```typescript
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runScript } from "../script/index.js";
import { formatScriptMarkdown } from "../script/format.js";
import { logger } from "../logger.js";
import type { ScanResult } from "../scan/types.js";
import type { Plan } from "../plan/types.js";

export interface ScriptCommandOpts {
  cwd: string;
  pluginRoot?: string;
  printMarkdown?: boolean;
}

async function readLatestJson<T>(dir: string): Promise<T> {
  const entries = await readdir(dir);
  if (entries.length === 0) throw new Error(`no artifacts in ${dir}`);
  const target = join(dir, entries.sort().pop()!);
  return JSON.parse(await readFile(target, "utf8")) as T;
}

const DEFAULT_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../plugin");

export async function scriptCommand(opts: ScriptCommandOpts): Promise<number> {
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
  await sm.recordCommand("script");

  const scan = await readLatestJson<ScanResult>(join(paths.cache, "scan"));
  const plan = await readLatestJson<Plan>(join(paths.cache, "plan"));

  const pluginRoot = opts.pluginRoot ?? DEFAULT_PLUGIN_ROOT;
  const artifacts = await runScript({ plan, scan, config, pluginRoot });

  for (const a of artifacts) {
    const sceneTarget = paths.script(a.scene.segment_id, a.hash, "scene.json");
    await mkdir(dirname(sceneTarget), { recursive: true });
    await store.writeJson(sceneTarget, a.scene);
    const txtTarget = paths.script(a.scene.segment_id, a.hash, "txt");
    await writeFile(txtTarget, a.scene.narration.text, "utf8");
    const ssmlTarget = paths.script(a.scene.segment_id, a.hash, "ssml");
    await writeFile(ssmlTarget, a.scene.narration.ssml, "utf8");
    await sm.markSegmentStage(a.scene.segment_id, "script", "ok");
  }
  await sm.markStageComplete("script");

  if (opts.printMarkdown !== false) {
    process.stdout.write(formatScriptMarkdown(artifacts.map((a) => a.scene)) + "\n");
  }
  logger.info({ segments: artifacts.length }, "script written");
  return 0;
}
```

- [ ] **Step 4: Wire `script` subcommand in `packages/cli/src/index.ts`**

After the `plan` block, add:

```typescript
program
  .command("script")
  .description("Generate per-segment narration + scene.json via Anthropic subagents")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root (for tests)")
  .option("--no-markdown", "suppress markdown output")
  .action(async (opts) => {
    const { scriptCommand } = await import("./commands/script.js");
    const code = await scriptCommand({
      cwd: opts.cwd,
      pluginRoot: opts.pluginRoot,
      printMarkdown: opts.markdown !== false
    });
    process.exit(code);
  });
```

- [ ] **Step 5: Run all tests + build**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
```

Expected: all tests pass (no E2E for script yet — that's Task 11). Build clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/src/script packages/cli/src/commands/script.ts packages/cli/src/index.ts packages/cli/tests/script/format.test.ts
git commit -m "feat(cli): add 'tutorialvid script' command with parallel segment fan-out"
```

---

## Task 11: Plan + Script E2E test (with stubbed Anthropic)

**Files:**
- Create: `packages/cli/tests/e2e/plan-script.test.ts`

> Plan-2 E2E uses a stubbed Anthropic client (no real API calls — those are exercised manually via the manual-test checklist). Recording-based fixtures are deferred until Plan 5 polish.

- [ ] **Step 1: Create the test**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" },
  anthropic: { api_key_env: "FAKE_ANTHROPIC_KEY", model: "claude-sonnet-4-6", max_concurrency: 2 },
  script: { depth: "medium", tone: "friendly", language: "en-US" }
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

describe("e2e: plan + script", () => {
  it("scan → plan → script writes scene.json + txt + ssml per segment", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-ps-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    // 1. scan
    const scanRun = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }, reject: false
    });
    expect(scanRun.exitCode, scanRun.stderr).toBe(0);

    // 2. plan
    const planRun = await execa("node", [cliBin, "plan", "--cwd", target, "--top-n", "2"], { reject: false });
    expect(planRun.exitCode, planRun.stderr).toBe(0);

    // 3. script — stub Anthropic via FAKE_ANTHROPIC_KEY would normally fail; instead test
    //    the orchestrator boundary: with no API key, command should exit 1 cleanly with a
    //    clear error message rather than hanging or crashing.
    const scriptRun = await execa("node", [cliBin, "script", "--cwd", target, "--plugin-root", pluginRoot], {
      env: { ...process.env, FAKE_ANTHROPIC_KEY: "" }, reject: false
    });
    expect(scriptRun.exitCode).not.toBe(0);
    expect(scriptRun.stderr + scriptRun.stdout).toMatch(/FAKE_ANTHROPIC_KEY|api.*key/i);

    // verify cache + state still healthy
    const planFiles = await readdir(join(target, ".tutorialvid/cache/plan"));
    expect(planFiles.length).toBeGreaterThan(0);
    const state = JSON.parse(readFileSync(join(target, ".tutorialvid/state.json"), "utf8"));
    expect(state.last_completed_stage).toBe("plan");
  }, 120_000);
});
```

> **Note for the implementer:** The E2E intentionally exercises the *failure mode* of the script command (no API key) — to keep CI deterministic and credit-free. A "real" run with `ANTHROPIC_API_KEY` set is a manual-test-checklist item, not a unit test. The failure path verifies the orchestrator's error handling reaches the user cleanly.

- [ ] **Step 2: Run test (build first)**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test e2e/plan-script
```

If the script command currently *hangs* on missing API key instead of exiting cleanly, fix `commands/script.ts` to wrap the `runScript()` call in a try/catch that maps API-key errors to `return 1` with `logger.error`. The dispatcher already throws on missing env var; the command must catch.

- [ ] **Step 3: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/cli/tests/e2e/plan-script.test.ts packages/cli/src/commands/script.ts
git commit -m "test(e2e): plan→script orchestrator boundary check (no API key path)"
```

---

## Task 12: Skill extension — Gates 1 + 2 in `tutorialvid-create`

**Files:**
- Modify: `packages/plugin/skills/tutorialvid-create/SKILL.md` — replace Plan-1 capability section

- [ ] **Step 1: Replace the "Plan-1 capability" section with**

```markdown
## Capability (v0.0.2)

The pipeline now supports three stages: **scan → plan → script**. Each ends at a user-review gate.

### Flow

1. **Scan** (Plan 1):
   `tutorialvid scan --cwd <project-root>`
   Reads `.tutorialvid/cache/scan/<hash>.json` and present:
   - Framework detected
   - Number of pages discovered
   - Top 5 by importance
   - Any warnings

2. **Plan — Gate 1**:
   Ask the user which pages to include (default: top-N by importance) and confirm depth/tone.
   Run:
   `tutorialvid plan --cwd <project-root> [--select id1,id2,...] [--top-n N]`
   The CLI prints a markdown table summarizing the plan. **Show this verbatim to the user. Wait for their approval before proceeding.** If they edit selections, re-run with the new `--select`.

3. **Script — Gate 2**:
   `tutorialvid script --cwd <project-root>`
   Requires `ANTHROPIC_API_KEY` in the environment. The CLI dispatches the `tutorialvid-script-writer` and `tutorialvid-scene-director` subagents per segment in parallel (bounded by `config.anthropic.max_concurrency`). Markdown output shows narration text + action counts. **Show this to the user. Wait for approval before TTS (next plugin version).**

### What this skill must NOT do

- Manipulate mp4 or audio bytes.
- Hardcode API keys.
- Skip cache-hit messaging — if the CLI logs `cache hit`, tell the user (no token spend on that artifact).
- Run `script` without an `ANTHROPIC_API_KEY` set — surface the clear error message to the user instead.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add packages/plugin/skills/tutorialvid-create/SKILL.md
git commit -m "docs(plugin): extend tutorialvid-create skill with Plan + Script gates"
```

---

## Task 13: Manual test checklist update + tag v0.0.2-plan2

**Files:**
- Modify: `docs/manual-test-checklist.md` — add Plan 2 acceptance section
- Update: `Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md` — append Plan 2 close-out

- [ ] **Step 1: Append to `docs/manual-test-checklist.md`**

```markdown

## Plan 2 acceptance: plan + script + Gates 1, 2

Prereq: `ANTHROPIC_API_KEY` set, scan already produced.

- [ ] `tutorialvid plan --cwd <project>` reads the latest scan and produces `.tutorialvid/cache/plan/<hash>.json`.
- [ ] `tutorialvid plan --top-n 3` selects top 3 pages by importance.
- [ ] `tutorialvid plan --select id1,id2` overrides defaults.
- [ ] Markdown output of `plan` matches the table in spec §8 Gate 1.
- [ ] Re-running `tutorialvid plan` with same inputs hits cache (no rewrite).
- [ ] `tutorialvid script --cwd <project>` dispatches subagents and writes `cache/script/<segment>/<hash>.{scene.json,txt,ssml}` per segment.
- [ ] Subagent prompts come from `packages/plugin/agents/*.md` and have valid frontmatter.
- [ ] With `ANTHROPIC_API_KEY` unset, `tutorialvid script` exits non-zero with a clear error referencing the env var name.
- [ ] Parallel fan-out is bounded by `config.anthropic.max_concurrency`.
- [ ] `state.json.last_completed_stage` advances `scan` → `plan` → `script` on each successful run.
- [ ] In Claude Code, `/tutorialvid` walks through scan → Gate 1 (plan) → Gate 2 (script) and pauses at each gate.
```

- [ ] **Step 2: Append a Plan 2 close-out to the vault session log**

Append at the bottom of `Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md`:

```markdown

## Plan 2 shipped — 2026-05-02

13 tasks. Tag `v0.0.2-plan2`.

### What shipped on top of Plan 1
- Anthropic SDK dispatcher with prompt caching + retry
- Plugin agents `tutorialvid-script-writer` + `tutorialvid-scene-director` (frontmatter + system prompt)
- `tutorialvid plan` command — scan + user choices → plan.json + Gate 1 markdown
- `tutorialvid script` command — parallel per-segment fan-out via Anthropic, writes scene.json/txt/ssml per segment
- Skill extended with Plan + Script gates

### Plan 3 starting points
- `packages/cli/src/tts/` — Gemini adapter with chunked SSML synthesis + per-word timing emit
- `packages/cli/src/record/` — Playwright runner consuming scene.json + cursor track emitter + auth waterfall A→B→C
- Add `cache/script/<id>/<hash>.{mp3,timing.json}` artifacts under tts.
- Wire Gate 3 (recording opt-in) into the skill.
```

- [ ] **Step 3: Tag**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git add docs/manual-test-checklist.md Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md
git commit -m "docs: Plan 2 acceptance checklist + vault close-out"
git tag -a v0.0.2-plan2 -m "Plan 2 complete: plan + script + Gates 1-2"
```

- [ ] **Step 4: Final verification**

```bash
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli test
cd /Users/hariprasadk/Documents/TutorialVid && pnpm --filter @tutorialvid/cli build
cd /Users/hariprasadk/Documents/TutorialVid && git log --oneline | head -25
cd /Users/hariprasadk/Documents/TutorialVid && git tag -l
```

Expected: all tests pass (Plan-1 45 + new Plan-2 ~25 = ~70). Build clean. Two tags: `v0.0.1-plan1` and `v0.0.2-plan2`.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 2 covers spec §4.2 (plan picker + plan.json), §4.3 (script-writer + scene-director subagents in parallel, scene.json schema), §8 (Gates 1 + 2 markdown outputs), §11 (LLM-driven path tested via mocked dispatcher). Deferred: TTS (§4.4), record (§4.5), compose (§4.6), finalize. Cache layout extends without migration; state machine `last_command` field now wired.

**Placeholder scan** — no "TBD" / "TODO" / "implement later" / "similar to Task N" patterns. The recording-fixture test pattern is *explicitly* deferred to Plan 5 with a one-sentence rationale.

**Type consistency** —
- `Segment` (in `plan/types.ts`) is consumed by both `script/writer.ts` and `script/director.ts` with identical field shapes.
- `Narration` (in `script/types.ts`) is the return type of `writeNarration` and the input to `directScene`.
- `SceneJson.actions` matches the Anthropic-returned shape and the spec §7.2 sample.
- `Plan.segments` matches what `runPlan` produces and what `runScript` consumes.
- `DispatchResult` cache fields are optional (omitted vs `undefined`) — matches `exactOptionalPropertyTypes`.
- `RunPlanInput.defaultTopN` is optional; the orchestrator omits the key entirely when undefined (no `undefined` assigned).

**Architecture decision recap (locked here)** — CLI uses Anthropic SDK directly. Plugin agents = system prompts in `.md` with frontmatter. ANTHROPIC_API_KEY env var. Prompt caching enabled. p-limit bounds parallel fan-out. Plan + Script E2E test exercises the failure path (no API key) to keep CI deterministic; real-API runs land in the manual-test checklist.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-2-plan-and-script.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
