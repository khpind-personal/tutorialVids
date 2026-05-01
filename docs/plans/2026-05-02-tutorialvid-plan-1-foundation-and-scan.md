# TutorialVid — Plan 1: Foundation + Scan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the TutorialVid monorepo with a Claude Code plugin skeleton and a Node CLI that runs `tutorialvid scan` against a fixture web app and produces a valid, content-hashed `scan.json` reconciled from code-graph + routes + crawl.

**Architecture:** pnpm workspace monorepo. Plugin = thin Claude Code orchestrator (skill + slash command). CLI = Node engine. They communicate via JSON files and exit codes only. Cache and state are filesystem-only, content-hashed.

**Tech Stack:** TypeScript 5, Node 20+, pnpm workspaces, Vitest (test runner), Playwright (crawler + later recorder), Zod (schema validation), commander (CLI), the `execa` package (process spawn), pino (structured logging). Fixture app: Vite + React + react-router-dom 7.

**Spec:** `docs/specs/2026-05-02-tutorialvid-design.md`

**Out of scope for Plan 1 (deferred to later plans):** plan/script/tts/record/compose stages, gate UX, Remotion, ffmpeg, Gemini, branding, music, watermark, finalize.

---

## File Structure (Plan 1 targets)

```
TutorialVid/
├── package.json                        — workspace root
├── pnpm-workspace.yaml                 — workspace config
├── tsconfig.base.json                  — shared TS config
├── .editorconfig
├── .nvmrc                              — node 20
├── packages/
│   ├── plugin/                         — @tutorialvid/plugin
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/
│   │   │   └── tutorialvid-create/
│   │   │       └── SKILL.md
│   │   ├── commands/
│   │   │   └── tutorialvid.md
│   │   ├── package.json
│   │   └── README.md
│   └── cli/                            — @tutorialvid/cli
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── bin/tutorialvid             — shebang dispatcher
│       ├── src/
│       │   ├── index.ts                — CLI entrypoint (commander)
│       │   ├── logger.ts               — pino wrapper
│       │   ├── config/
│       │   │   ├── schema.ts           — Zod schema for config.json
│       │   │   └── load.ts             — load + validate config
│       │   ├── cache/
│       │   │   ├── hash.ts             — content-hash helper
│       │   │   ├── store.ts            — read/write/invalidate
│       │   │   └── paths.ts            — resolve cache paths
│       │   ├── state/
│       │   │   └── machine.ts          — read/write state.json, gate tracking
│       │   ├── scan/
│       │   │   ├── index.ts            — orchestrator
│       │   │   ├── framework.ts        — detect framework from package.json
│       │   │   ├── routes/
│       │   │   │   ├── index.ts        — pluggable parser registry
│       │   │   │   └── react-router.ts — React Router 7 parser
│       │   │   ├── graph.ts            — code-review-graph / graphify bridge
│       │   │   ├── crawl.ts            — Playwright crawler
│       │   │   ├── reconcile.ts        — merge sources → ScanResult
│       │   │   └── types.ts            — ScanResult, PageEntry, etc.
│       │   └── commands/
│       │       └── scan.ts             — `tutorialvid scan` handler
│       └── tests/
│           ├── cache/hash.test.ts
│           ├── cache/store.test.ts
│           ├── state/machine.test.ts
│           ├── config/load.test.ts
│           ├── scan/framework.test.ts
│           ├── scan/routes/react-router.test.ts
│           ├── scan/graph.test.ts
│           ├── scan/reconcile.test.ts
│           └── e2e/scan.test.ts
└── fixtures/
    └── sample-app/                     — minimal Vite + React Router + auth
```

(See Tasks 1–17 below for the per-task code, tests, and commit cadence.)

---

## Task 1: Initialize monorepo

**Files:**
- Create: `/Users/hariprasadk/Documents/TutorialVid/package.json`
- Create: `/Users/hariprasadk/Documents/TutorialVid/pnpm-workspace.yaml`
- Create: `/Users/hariprasadk/Documents/TutorialVid/tsconfig.base.json`
- Create: `/Users/hariprasadk/Documents/TutorialVid/.nvmrc`
- Create: `/Users/hariprasadk/Documents/TutorialVid/.editorconfig`

- [ ] **Step 1: Initialize git repository**

```bash
cd /Users/hariprasadk/Documents/TutorialVid
git init
git add .gitignore README.md CLAUDE.md docs/ Vault/
git commit -m "chore: initial project skeleton"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "tutorialvid",
  "private": true,
  "version": "0.0.0",
  "description": "Turn vibe-coded web apps into polished tutorial videos",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20.0.0", "pnpm": ">=9" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": { "typescript": "^5.5.0" },
  "packageManager": "pnpm@9.7.0"
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "fixtures/*"
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Create `.nvmrc` and `.editorconfig`**

`.nvmrc`:
```
20
```

`.editorconfig`:
```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 6: Verify pnpm install works**

```bash
pnpm install
```

Expected: completes without error, creates `pnpm-lock.yaml`, no packages installed yet.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .nvmrc .editorconfig pnpm-lock.yaml
git commit -m "chore: pnpm workspace + base TS config"
```

---

## Task 2: CLI package scaffolding

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/bin/tutorialvid`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/logger.ts`

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "@tutorialvid/cli",
  "version": "0.0.1",
  "description": "TutorialVid Node CLI engine",
  "license": "MIT",
  "type": "module",
  "bin": { "tutorialvid": "./bin/tutorialvid" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "bin"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "execa": "^9.4.0",
    "pino": "^9.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "vitest": "^2.1.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Create `packages/cli/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    reporters: "default"
  }
});
```

- [ ] **Step 4: Create `packages/cli/bin/tutorialvid`**

```bash
#!/usr/bin/env node
import("../dist/index.js");
```

Mark executable: `chmod +x packages/cli/bin/tutorialvid`.

- [ ] **Step 5: Create `packages/cli/src/logger.ts`**

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.TV_LOG_LEVEL ?? "info"
});
```

- [ ] **Step 6: Write failing test for CLI entrypoint help**

Create `packages/cli/tests/cli.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { execa } from "execa";

describe("CLI entrypoint", () => {
  it("prints help when invoked with --help", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      ["./bin/tutorialvid", "--help"],
      { cwd: new URL("..", import.meta.url).pathname, reject: false }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Usage:\s+tutorialvid/);
    expect(stdout).toMatch(/Commands:/);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test
```

Expected: FAIL — `dist/index.js` does not exist.

- [ ] **Step 8: Create `packages/cli/src/index.ts`**

```typescript
import { Command } from "commander";
import { logger } from "./logger.js";

const program = new Command();

program
  .name("tutorialvid")
  .description("Turn vibe-coded web apps into tutorial videos")
  .version("0.0.1");

program
  .command("scan")
  .description("Reconcile code-graph + routes + crawl into a scan.json")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--config <path>", "config file path", ".tutorialvid/config.json")
  .action(async (opts) => {
    logger.info({ opts }, "scan invoked (not implemented yet)");
    process.exit(2);
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, "CLI fatal error");
  process.exit(1);
});
```

- [ ] **Step 9: Build and re-run test to verify pass**

```bash
pnpm --filter @tutorialvid/cli build
pnpm --filter @tutorialvid/cli test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): scaffold @tutorialvid/cli with help + scan command stub"
```

---

## Task 3: Cache hashing module

**Files:**
- Create: `packages/cli/src/cache/hash.ts`
- Test: `packages/cli/tests/cache/hash.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/cache/hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashInputs } from "../../src/cache/hash.js";

describe("hashInputs", () => {
  it("returns a 16-char hex string", () => {
    expect(hashInputs({ a: 1, b: "x" })).toMatch(/^[0-9a-f]{16}$/);
  });
  it("is deterministic for same inputs", () => {
    expect(hashInputs({ a: 1, b: 2 })).toBe(hashInputs({ a: 1, b: 2 }));
  });
  it("is order-independent for object keys", () => {
    expect(hashInputs({ a: 1, b: 2 })).toBe(hashInputs({ b: 2, a: 1 }));
  });
  it("differs on different inputs", () => {
    expect(hashInputs({ a: 1 })).not.toBe(hashInputs({ a: 2 }));
  });
  it("handles nested objects deterministically", () => {
    expect(hashInputs({ a: { x: 1, y: 2 } })).toBe(hashInputs({ a: { y: 2, x: 1 } }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test cache/hash
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cache/hash.ts`**

```typescript
import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

export function hashInputs(inputs: unknown): string {
  return createHash("sha256").update(canonicalize(inputs)).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test cache/hash
```

Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cache/hash.ts packages/cli/tests/cache/hash.test.ts
git commit -m "feat(cli): add deterministic hashInputs for cache keys"
```

---

## Task 4: Cache paths module

**Files:**
- Create: `packages/cli/src/cache/paths.ts`
- Test: `packages/cli/tests/cache/paths.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/cache/paths.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { cachePaths } from "../../src/cache/paths.js";

describe("cachePaths", () => {
  const root = "/repo";
  it("scan path", () => {
    expect(cachePaths(root).scan("abc1234567890def"))
      .toBe("/repo/.tutorialvid/cache/scan/abc1234567890def.json");
  });
  it("plan path", () => {
    expect(cachePaths(root).plan("h1")).toBe("/repo/.tutorialvid/cache/plan/h1.json");
  });
  it("script segment artifact path", () => {
    expect(cachePaths(root).script("s01", "h1", "scene.json"))
      .toBe("/repo/.tutorialvid/cache/script/s01/h1.scene.json");
  });
  it("record segment mp4 path", () => {
    expect(cachePaths(root).record("s01", "h1", "mp4"))
      .toBe("/repo/.tutorialvid/cache/record/s01/h1.mp4");
  });
  it("state path", () => {
    expect(cachePaths(root).state()).toBe("/repo/.tutorialvid/state.json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test cache/paths
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cache/paths.ts`**

```typescript
import { join } from "node:path";

export function cachePaths(projectRoot: string) {
  const base = join(projectRoot, ".tutorialvid");
  const cache = join(base, "cache");
  return {
    base,
    cache,
    scan: (hash: string) => join(cache, "scan", `${hash}.json`),
    plan: (hash: string) => join(cache, "plan", `${hash}.json`),
    script: (segmentId: string, hash: string, ext: string) =>
      join(cache, "script", segmentId, `${hash}.${ext}`),
    record: (segmentId: string, hash: string, ext: string) =>
      join(cache, "record", segmentId, `${hash}.${ext}`),
    compose: (segmentId: string, hash: string) =>
      join(cache, "compose", segmentId, `${hash}.mp4`),
    final: (hash: string) => join(cache, "final", `${hash}.mp4`),
    state: () => join(base, "state.json"),
    storageState: () => join(base, "storage-state.json")
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test cache/paths
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cache/paths.ts packages/cli/tests/cache/paths.test.ts
git commit -m "feat(cli): add cachePaths resolver for artifact tree"
```

---

## Task 5: Cache store (read / write / invalidate)

**Files:**
- Create: `packages/cli/src/cache/store.ts`
- Test: `packages/cli/tests/cache/store.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/cache/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CacheStore } from "../../src/cache/store.js";
import { cachePaths } from "../../src/cache/paths.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-")); });

describe("CacheStore", () => {
  it("writes JSON and reads it back", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    const target = paths.scan("abc");
    await store.writeJson(target, { foo: 1 });
    expect(existsSync(target)).toBe(true);
    expect(await store.readJson<{ foo: number }>(target)).toEqual({ foo: 1 });
  });
  it("returns null on cache miss", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    expect(await store.readJson(paths.scan("missing"))).toBeNull();
  });
  it("invalidates a single file", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    const target = paths.plan("p1");
    await store.writeJson(target, { ok: true });
    await store.invalidate(target);
    expect(existsSync(target)).toBe(false);
  });
  it("invalidates a whole stage directory", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    await store.writeJson(paths.plan("p1"), { ok: 1 });
    await store.writeJson(paths.plan("p2"), { ok: 2 });
    await store.invalidateStage(join(paths.cache, "plan"));
    expect(existsSync(paths.plan("p1"))).toBe(false);
    expect(existsSync(paths.plan("p2"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test cache/store
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cache/store.ts`**

```typescript
import { dirname } from "node:path";
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import type { cachePaths } from "./paths.js";

type Paths = ReturnType<typeof cachePaths>;

export class CacheStore {
  constructor(private paths: Paths) {}
  async writeJson(target: string, payload: unknown): Promise<void> {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(payload, null, 2), "utf8");
  }
  async readJson<T = unknown>(target: string): Promise<T | null> {
    try { await access(target); } catch { return null; }
    return JSON.parse(await readFile(target, "utf8")) as T;
  }
  async invalidate(target: string): Promise<void> {
    await rm(target, { force: true });
  }
  async invalidateStage(stageDir: string): Promise<void> {
    await rm(stageDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test cache/store
```

Expected: PASS, all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cache/store.ts packages/cli/tests/cache/store.test.ts
git commit -m "feat(cli): add CacheStore (read/write/invalidate)"
```

---

## Task 6: State machine module

**Files:**
- Create: `packages/cli/src/state/machine.ts`
- Test: `packages/cli/tests/state/machine.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/state/machine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateMachine, type Stage } from "../../src/state/machine.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-state-")); });

describe("StateMachine", () => {
  it("starts empty when no state file exists", async () => {
    const sm = new StateMachine(root);
    const s = await sm.load();
    expect(s.last_completed_stage).toBeNull();
    expect(s.gates_passed).toEqual([]);
    expect(s.segments).toEqual({});
  });
  it("records stage completion", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.markStageComplete("scan");
    const s = await sm.load();
    expect(s.last_completed_stage).toBe("scan");
  });
  it("tracks per-segment status", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.markSegmentStage("s01", "scan", "ok");
    await sm.markSegmentStage("s01", "record", "failed", "selector timed out");
    const s = await sm.load();
    expect(s.segments.s01?.scan).toBe("ok");
    expect(s.segments.s01?.record).toBe("failed");
    expect(s.segments.s01?.last_error).toBe("selector timed out");
  });
  it("records gate pass exactly once", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.passGate("plan");
    await sm.passGate("plan");
    const s = await sm.load();
    expect(s.gates_passed).toEqual(["plan"]);
  });
  it("rejects unknown stages", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await expect(sm.markStageComplete("nope" as Stage)).rejects.toThrow(/unknown stage/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test state/machine
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `state/machine.ts`**

```typescript
import { join } from "node:path";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";

export const STAGES = ["scan", "plan", "script", "tts", "record", "compose", "final"] as const;
export type Stage = typeof STAGES[number];

export const GATES = ["plan", "script", "recording", "final-draft"] as const;
export type Gate = typeof GATES[number];

export type SegmentStageStatus = "pending" | "ok" | "failed" | "skipped";

export interface State {
  last_completed_stage: Stage | null;
  last_command: string | null;
  started_at: string;
  gates_passed: Gate[];
  segments: Record<string, Partial<Record<Stage, SegmentStageStatus>> & { last_error?: string }>;
}

const EMPTY: State = {
  last_completed_stage: null,
  last_command: null,
  started_at: new Date().toISOString(),
  gates_passed: [],
  segments: {}
};

export class StateMachine {
  private statePath: string;
  private cached: State | null = null;
  constructor(projectRoot: string) {
    this.statePath = join(projectRoot, ".tutorialvid", "state.json");
  }
  async load(): Promise<State> {
    try {
      await access(this.statePath);
      this.cached = JSON.parse(await readFile(this.statePath, "utf8")) as State;
    } catch {
      this.cached = { ...EMPTY, started_at: new Date().toISOString() };
    }
    return this.cached;
  }
  private async save(): Promise<void> {
    if (!this.cached) throw new Error("state not loaded");
    await mkdir(join(this.statePath, ".."), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.cached, null, 2), "utf8");
  }
  async markStageComplete(stage: Stage): Promise<void> {
    if (!STAGES.includes(stage)) throw new Error(`unknown stage: ${stage}`);
    const s = await this.load();
    s.last_completed_stage = stage;
    await this.save();
  }
  async markSegmentStage(segmentId: string, stage: Stage, status: SegmentStageStatus, lastError?: string): Promise<void> {
    if (!STAGES.includes(stage)) throw new Error(`unknown stage: ${stage}`);
    const s = await this.load();
    const seg = s.segments[segmentId] ?? {};
    seg[stage] = status;
    if (lastError) seg.last_error = lastError;
    s.segments[segmentId] = seg;
    await this.save();
  }
  async passGate(gate: Gate): Promise<void> {
    const s = await this.load();
    if (!s.gates_passed.includes(gate)) s.gates_passed.push(gate);
    await this.save();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test state/machine
```

Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/state/machine.ts packages/cli/tests/state/machine.test.ts
git commit -m "feat(cli): add StateMachine for resumable pipeline status"
```

---

## Task 7: Config schema + loader

**Files:**
- Create: `packages/cli/src/config/schema.ts`
- Create: `packages/cli/src/config/load.ts`
- Test: `packages/cli/tests/config/load.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/config/load.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/load.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tv-cfg-"));
  mkdirSync(join(root, ".tutorialvid"));
});

const valid = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false },
  auth: { mode: "waterfall" },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" }
};

describe("loadConfig", () => {
  it("loads + validates a valid config", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.app.name).toBe("Sample");
    expect(cfg.render.fps).toBe(30);
  });
  it("rejects missing file with clear error", async () => {
    await expect(loadConfig(root)).rejects.toThrow(/config not found/i);
  });
  it("rejects invalid schema", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify({ version: 1 }));
    await expect(loadConfig(root)).rejects.toThrow(/invalid config/i);
  });
  it("applies sensible defaults for optional fields", async () => {
    writeFileSync(join(root, ".tutorialvid/config.json"), JSON.stringify(valid));
    const cfg = await loadConfig(root);
    expect(cfg.telemetry?.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test config/load
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `config/schema.ts`**

```typescript
import { z } from "zod";

export const ConfigSchema = z.object({
  version: z.literal(1),
  app: z.object({
    name: z.string().min(1),
    dev_url: z.string().url(),
    start_server: z.boolean().default(false),
    framework_hint: z.string().optional()
  }),
  auth: z.object({
    mode: z.literal("waterfall"),
    credentials: z.object({
      username_env: z.string(),
      password_env: z.string(),
      username_selector: z.string(),
      password_selector: z.string(),
      submit_selector: z.string(),
      login_url: z.string()
    }).optional(),
    storage_state_path: z.string().optional(),
    show_login_in_tutorial: z.boolean().default(false)
  }),
  seed: z.object({
    command: z.string(),
    skip_if_exists: z.string().optional()
  }).optional(),
  branding: z.object({
    logo_path: z.string().optional(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    intro_template: z.string().optional(),
    outro_template: z.string().optional(),
    outro_cta: z.string().optional()
  }).optional(),
  render: z.object({
    resolution: z.string().regex(/^\d+x\d+$/),
    fps: z.number().int().positive(),
    max_total_duration_s: z.number().positive(),
    max_segment_duration_s: z.number().positive()
  }),
  tts: z.object({
    provider: z.literal("gemini"),
    api_key_env: z.string(),
    language: z.string()
  }),
  telemetry: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
});

export type Config = z.infer<typeof ConfigSchema>;
```

- [ ] **Step 4: Implement `config/load.ts`**

```typescript
import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import { ConfigSchema, type Config } from "./schema.js";

export async function loadConfig(projectRoot: string): Promise<Config> {
  const path = join(projectRoot, ".tutorialvid", "config.json");
  try { await access(path); }
  catch { throw new Error(`config not found at ${path}`); }
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (err) { throw new Error(`config is not valid JSON: ${(err as Error).message}`); }
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) throw new Error(`invalid config: ${result.error.message}`);
  return result.data;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test config/load
```

Expected: PASS, all 4 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/config packages/cli/tests/config
git commit -m "feat(cli): add Zod config schema + loader"
```

---

## Task 8: Fixture sample-app — minimal Vite + React Router

**Files:**
- Create: `fixtures/sample-app/package.json`
- Create: `fixtures/sample-app/vite.config.ts`
- Create: `fixtures/sample-app/tsconfig.json`
- Create: `fixtures/sample-app/index.html`
- Create: `fixtures/sample-app/src/main.tsx`
- Create: `fixtures/sample-app/src/router.tsx`
- Create: `fixtures/sample-app/src/auth.ts`
- Create: `fixtures/sample-app/src/pages/Login.tsx`
- Create: `fixtures/sample-app/src/pages/Dashboard.tsx`
- Create: `fixtures/sample-app/src/pages/Profile.tsx`

- [ ] **Step 1: `fixtures/sample-app/package.json`**

```json
{
  "name": "@tutorialvid/fixture-sample-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173 --strictPort",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: `fixtures/sample-app/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
```

- [ ] **Step 3: `fixtures/sample-app/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: `fixtures/sample-app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sample App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `fixtures/sample-app/src/auth.ts`**

```typescript
const KEY = "tv-fixture-session";
export function login(username: string, password: string): boolean {
  if (username === "demo" && password === "demo") {
    localStorage.setItem(KEY, JSON.stringify({ username, t: Date.now() }));
    return true;
  }
  return false;
}
export function logout(): void { localStorage.removeItem(KEY); }
export function isAuthed(): boolean { return localStorage.getItem(KEY) !== null; }
export function currentUser(): string | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { username: string }).username;
}
```

- [ ] **Step 6: `fixtures/sample-app/src/pages/Login.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Sign in</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (login(u, p)) nav("/dashboard");
        else setErr("Invalid credentials. Try demo / demo.");
      }}>
        <div><label>Username <input data-test="username" name="username" value={u} onChange={(e) => setU(e.target.value)} /></label></div>
        <div><label>Password <input data-test="password" name="password" type="password" value={p} onChange={(e) => setP(e.target.value)} /></label></div>
        <button data-test="submit" type="submit">Sign in</button>
        {err && <p role="alert">{err}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 7: `fixtures/sample-app/src/pages/Dashboard.tsx`**

```tsx
import { Link } from "react-router-dom";
import { currentUser, logout } from "../auth";
export default function Dashboard() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {currentUser()}.</p>
      <ul><li><Link data-test="link-profile" to="/profile">Profile</Link></li></ul>
      <button data-test="logout" onClick={logout}>Sign out</button>
    </main>
  );
}
```

- [ ] **Step 8: `fixtures/sample-app/src/pages/Profile.tsx`**

```tsx
import { Link } from "react-router-dom";
import { currentUser } from "../auth";
export default function Profile() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Profile</h1>
      <p>Username: {currentUser()}</p>
      <Link data-test="link-dashboard" to="/dashboard">Back to dashboard</Link>
    </main>
  );
}
```

- [ ] **Step 9: `fixtures/sample-app/src/router.tsx`**

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import { isAuthed } from "./auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/dashboard", element: <RequireAuth><Dashboard /></RequireAuth> },
  { path: "/profile", element: <RequireAuth><Profile /></RequireAuth> }
]);
```

- [ ] **Step 10: `fixtures/sample-app/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

- [ ] **Step 11: Verify fixture builds and runs**

```bash
pnpm install
pnpm --filter @tutorialvid/fixture-sample-app build
```

Expected: build succeeds.

```bash
pnpm --filter @tutorialvid/fixture-sample-app dev &
sleep 3
curl -fsS http://localhost:5173/ > /dev/null
kill %1
```

Expected: 200 OK, dev server killed.

- [ ] **Step 12: Commit**

```bash
git add fixtures/sample-app pnpm-lock.yaml
git commit -m "feat(fixture): minimal Vite+RR7 sample-app for scan tests"
```

---

## Task 9: Scan — framework detector

**Files:**
- Create: `packages/cli/src/scan/framework.ts`
- Create: `packages/cli/src/scan/types.ts`
- Test: `packages/cli/tests/scan/framework.test.ts`

- [ ] **Step 1: Create `scan/types.ts`**

```typescript
export type Framework =
  | "react-router" | "next-app" | "vite-router"
  | "tanstack-router" | "astro" | "unknown";

export interface ScanResult {
  framework: Framework;
  base_url: string;
  pages: PageEntry[];
  flows: FlowEntry[];
  warnings: Warning[];
}

export interface PageEntry {
  id: string;
  route: string;
  title: string;
  graph_node?: string;
  primary_actions: ActionHint[];
  requires_auth: boolean;
  needs_seed: boolean;
  importance: number;
}

export interface ActionHint {
  selector: string;
  label: string;
  kind: "click" | "input" | "submit" | "link";
}

export interface FlowEntry {
  id: string;
  name: string;
  page_ids: string[];
}

export interface Warning {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
```

- [ ] **Step 2: Write failing test**

Create `packages/cli/tests/scan/framework.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFramework } from "../../src/scan/framework.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-fw-")); });

function writePkg(deps: Record<string, string>) {
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: deps }));
}

describe("detectFramework", () => {
  it("detects react-router from react-router-dom dep", async () => {
    writePkg({ "react-router-dom": "^7.0.0" });
    expect(await detectFramework(root)).toBe("react-router");
  });
  it("detects next-app from next dep + app dir", async () => {
    writePkg({ "next": "^14.0.0" });
    mkdirSync(join(root, "app"));
    expect(await detectFramework(root)).toBe("next-app");
  });
  it("detects astro from astro dep", async () => {
    writePkg({ "astro": "^4.0.0" });
    expect(await detectFramework(root)).toBe("astro");
  });
  it("detects tanstack-router from @tanstack/react-router dep", async () => {
    writePkg({ "@tanstack/react-router": "^1.0.0" });
    expect(await detectFramework(root)).toBe("tanstack-router");
  });
  it("returns unknown when no recognized framework", async () => {
    writePkg({});
    expect(await detectFramework(root)).toBe("unknown");
  });
  it("uses framework_hint override when provided", async () => {
    writePkg({});
    expect(await detectFramework(root, "vite-router")).toBe("vite-router");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test scan/framework
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `scan/framework.ts`**

```typescript
import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import type { Framework } from "./types.js";

const ALL: Framework[] = ["react-router", "next-app", "vite-router", "tanstack-router", "astro", "unknown"];

function isFramework(s: string): s is Framework { return (ALL as string[]).includes(s); }

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function detectFramework(projectRoot: string, hint?: string): Promise<Framework> {
  if (hint && isFramework(hint)) return hint;
  const pkgPath = join(projectRoot, "package.json");
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch { return "unknown"; }
  if (deps["next"]) {
    if (await pathExists(join(projectRoot, "app"))) return "next-app";
    return "next-app";
  }
  if (deps["@tanstack/react-router"]) return "tanstack-router";
  if (deps["astro"]) return "astro";
  if (deps["react-router-dom"]) return "react-router";
  return "unknown";
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test scan/framework
```

Expected: PASS, all 6 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/scan/framework.ts packages/cli/src/scan/types.ts packages/cli/tests/scan/framework.test.ts
git commit -m "feat(scan): add framework detector + ScanResult types"
```

---

## Task 10: Scan — React Router 7 routes parser

**Files:**
- Create: `packages/cli/src/scan/routes/index.ts`
- Create: `packages/cli/src/scan/routes/react-router.ts`
- Test: `packages/cli/tests/scan/routes/react-router.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/scan/routes/react-router.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReactRouterRoutes } from "../../../src/scan/routes/react-router.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-rr-")); });

function writeRouter(content: string) {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/router.tsx"), content);
}

describe("parseReactRouterRoutes", () => {
  it("extracts routes from createBrowserRouter array", async () => {
    writeRouter(`
      import { createBrowserRouter } from "react-router-dom";
      export const router = createBrowserRouter([
        { path: "/login", element: <Login /> },
        { path: "/dashboard", element: <Dashboard /> },
        { path: "/profile", element: <Profile /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes.map(r => r.path).sort()).toEqual(["/dashboard", "/login", "/profile"]);
  });

  it("ignores Navigate redirects", async () => {
    writeRouter(`
      export const router = createBrowserRouter([
        { path: "/", element: <Navigate to="/dashboard" /> },
        { path: "/dashboard", element: <Dashboard /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes.find(r => r.path === "/")).toBeUndefined();
    expect(routes.find(r => r.path === "/dashboard")).toBeDefined();
  });

  it("captures element name for each route", async () => {
    writeRouter(`
      export const router = createBrowserRouter([
        { path: "/x", element: <Foo /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes[0]?.element).toBe("Foo");
  });

  it("returns empty array when no router file found", async () => {
    expect(await parseReactRouterRoutes(root)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test scan/routes/react-router
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scan/routes/react-router.ts`**

```typescript
import { glob } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface RouteEntry {
  path: string;
  element?: string;
}

const ROUTER_GLOB = ["src/**/router.{ts,tsx}", "src/**/routes.{ts,tsx}"];

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const pattern of ROUTER_GLOB) {
    for await (const f of glob(pattern, { cwd: root })) {
      out.push(join(root, f));
    }
  }
  return out;
}

function extractRoutesFromSource(text: string): RouteEntry[] {
  const cleaned = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /path:\s*["'`]([^"'`]+)["'`][^}]*?element:\s*<\s*([A-Za-z_$][\w$]*)\b/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const [, path, element] = m;
    if (element === "Navigate") continue;
    routes.push({ path, element });
  }
  return routes;
}

export async function parseReactRouterRoutes(projectRoot: string): Promise<RouteEntry[]> {
  const files = await collectFiles(projectRoot);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (!text.includes("createBrowserRouter") && !text.includes("createMemoryRouter")) continue;
    return extractRoutesFromSource(text);
  }
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test scan/routes/react-router
```

Expected: PASS, all 4 cases.

- [ ] **Step 5: Implement parser registry `scan/routes/index.ts`**

```typescript
import type { Framework } from "../types.js";
import { parseReactRouterRoutes, type RouteEntry } from "./react-router.js";

export type { RouteEntry };

export async function parseRoutes(framework: Framework, projectRoot: string): Promise<RouteEntry[]> {
  switch (framework) {
    case "react-router": return parseReactRouterRoutes(projectRoot);
    case "next-app":
    case "vite-router":
    case "tanstack-router":
    case "astro":
    case "unknown": return [];
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/scan/routes packages/cli/tests/scan/routes
git commit -m "feat(scan): React Router 7 routes parser + pluggable registry"
```

---

## Task 11: Scan — code-graph reader (graphify CLI bridge)

**Files:**
- Create: `packages/cli/src/scan/graph.ts`
- Test: `packages/cli/tests/scan/graph.test.ts`

> Plan-1 implements only the graphify CLI bridge. The MCP-bridge variant is deferred to Plan 2 once we know which transport is more reliable for vibe coders.

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/scan/graph.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readGraph } from "../../src/scan/graph.js";

const fakeGraph = {
  nodes: [
    { id: "n1", label: "Login.tsx::default", file: "src/pages/Login.tsx", kind: "function" },
    { id: "n2", label: "Dashboard.tsx::default", file: "src/pages/Dashboard.tsx", kind: "function" }
  ],
  links: [{ source: "n1", target: "n2" }]
};

vi.mock("execa", () => ({
  execa: vi.fn(async (_bin: string, args: string[]) => {
    if (args.includes("--json")) return { stdout: JSON.stringify(fakeGraph), exitCode: 0 };
    return { stdout: "", exitCode: 0 };
  })
}));

beforeEach(() => vi.clearAllMocks());

describe("readGraph", () => {
  it("reads nodes + links from graphify JSON output", async () => {
    const g = await readGraph("/some/root");
    expect(g.nodes).toHaveLength(2);
    expect(g.links).toHaveLength(1);
  });
  it("returns empty graph + warning when graphify is unavailable", async () => {
    const mod = await import("execa");
    (mod.execa as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("ENOENT"));
    const g = await readGraph("/some/root");
    expect(g.nodes).toEqual([]);
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.warnings[0].code).toBe("graphify-missing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test scan/graph
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scan/graph.ts`**

```typescript
import { execa } from "execa";
import type { Warning } from "./types.js";

export interface GraphNode { id: string; label: string; file: string; kind: string; }
export interface GraphLink { source: string; target: string; }
export interface GraphResult {
  nodes: GraphNode[];
  links: GraphLink[];
  warnings: Warning[];
}

export async function readGraph(projectRoot: string): Promise<GraphResult> {
  try {
    const { stdout } = await execa("graphify", ["query", "--root", projectRoot, "--json"]);
    const parsed = JSON.parse(stdout) as { nodes?: GraphNode[]; links?: GraphLink[] };
    return { nodes: parsed.nodes ?? [], links: parsed.links ?? [], warnings: [] };
  } catch (err) {
    return {
      nodes: [],
      links: [],
      warnings: [{
        code: "graphify-missing",
        message: `code-graph unavailable: ${(err as Error).message}. Install graphifyy or run code-review-graph MCP.`
      }]
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test scan/graph
```

Expected: PASS, both cases.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/scan/graph.ts packages/cli/tests/scan/graph.test.ts
git commit -m "feat(scan): graphify CLI bridge with degraded-mode warning"
```

---

## Task 12: Scan — Playwright crawler

**Files:**
- Create: `packages/cli/src/scan/crawl.ts`
- Test: `packages/cli/tests/scan/crawl.test.ts`
- Modify: `packages/cli/package.json` — add Playwright dependency

- [ ] **Step 1: Add Playwright dependency**

```bash
pnpm --filter @tutorialvid/cli add playwright@^1.48.0
pnpm --filter @tutorialvid/cli playwright install chromium
```

- [ ] **Step 2: Write failing test (E2E against fixture sample-app)**

Create `packages/cli/tests/scan/crawl.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { setTimeout as wait } from "node:timers/promises";
import { crawl } from "../../src/scan/crawl.js";

let server: ResultPromise | undefined;

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], {
    stdout: "ignore", stderr: "ignore"
  });
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("sample-app dev server did not start in time");
}, 60_000);

afterAll(async () => { server?.kill("SIGTERM"); });

describe("crawl", () => {
  it("discovers /login, /dashboard, /profile after auth", async () => {
    const result = await crawl({
      baseUrl: "http://localhost:5173",
      maxDepth: 3,
      auth: {
        loginUrl: "/login",
        usernameSelector: "[data-test=username]",
        passwordSelector: "[data-test=password]",
        submitSelector: "[data-test=submit]",
        username: "demo",
        password: "demo"
      }
    });
    const routes = result.pages.map(p => p.route).sort();
    expect(routes).toEqual(expect.arrayContaining(["/dashboard", "/login", "/profile"]));
    expect(result.pages.find(p => p.route === "/dashboard")?.title.toLowerCase()).toContain("dashboard");
  }, 60_000);
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test scan/crawl
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `scan/crawl.ts`**

```typescript
import { chromium, type Page } from "playwright";
import type { ActionHint, Warning } from "./types.js";

export interface CrawlAuth {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
}

export interface CrawlOpts {
  baseUrl: string;
  maxDepth?: number;
  auth?: CrawlAuth;
}

export interface CrawledPage {
  route: string;
  title: string;
  primary_actions: ActionHint[];
}

export interface CrawlResult {
  pages: CrawledPage[];
  warnings: Warning[];
}

async function collectActions(page: Page): Promise<ActionHint[]> {
  const buttons = await page.$$eval("button", (els) =>
    els.slice(0, 5).map((b) => {
      const buildSelector = (el: Element): string => {
        const dt = el.getAttribute("data-test");
        if (dt) return `[data-test="${dt}"]`;
        const name = el.getAttribute("name");
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
        const id = el.id;
        if (id) return `#${id}`;
        return el.tagName.toLowerCase();
      };
      return {
        selector: buildSelector(b),
        label: ((b as HTMLButtonElement).textContent ?? "").trim().slice(0, 60),
        kind: ((b as HTMLButtonElement).type === "submit" ? "submit" : "click") as "submit" | "click"
      };
    })
  );
  const links = await page.$$eval("a[href]", (els) =>
    els.slice(0, 5).map((a) => {
      const buildSelector = (el: Element): string => {
        const dt = el.getAttribute("data-test");
        if (dt) return `[data-test="${dt}"]`;
        const id = el.id; if (id) return `#${id}`;
        return el.tagName.toLowerCase();
      };
      return {
        selector: buildSelector(a),
        label: ((a as HTMLAnchorElement).textContent ?? "").trim().slice(0, 60),
        kind: "link" as const
      };
    })
  );
  const inputs = await page.$$eval("input[name],textarea[name]", (els) =>
    els.slice(0, 5).map((i) => {
      const buildSelector = (el: Element): string => {
        const dt = el.getAttribute("data-test");
        if (dt) return `[data-test="${dt}"]`;
        const name = el.getAttribute("name");
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
        return el.tagName.toLowerCase();
      };
      return {
        selector: buildSelector(i),
        label: (i.getAttribute("name") ?? "input").slice(0, 60),
        kind: "input" as const
      };
    })
  );
  return [...buttons, ...links, ...inputs] as ActionHint[];
}

export async function crawl(opts: CrawlOpts): Promise<CrawlResult> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const warnings: Warning[] = [];

    if (opts.auth) {
      await page.goto(new URL(opts.auth.loginUrl, opts.baseUrl).toString());
      await page.fill(opts.auth.usernameSelector, opts.auth.username);
      await page.fill(opts.auth.passwordSelector, opts.auth.password);
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.click(opts.auth.submitSelector)
      ]);
    }

    const visited = new Map<string, CrawledPage>();
    const queue: { route: string; depth: number }[] = [{ route: "/", depth: 0 }];
    const maxDepth = opts.maxDepth ?? 3;
    const baseOrigin = new URL(opts.baseUrl).origin;

    while (queue.length > 0) {
      const { route, depth } = queue.shift()!;
      if (visited.has(route)) continue;

      try {
        await page.goto(new URL(route, opts.baseUrl).toString(), { waitUntil: "networkidle" });
      } catch (err) {
        warnings.push({ code: "crawl-nav-failed", message: `failed to navigate to ${route}: ${(err as Error).message}` });
        continue;
      }

      const finalRoute = new URL(page.url()).pathname;
      const title = await page.title();
      const actions = await collectActions(page);
      visited.set(finalRoute, { route: finalRoute, title, primary_actions: actions });

      if (depth >= maxDepth) continue;
      const links = await page.$$eval("a[href]", (els) =>
        els.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "").filter(Boolean)
      );
      for (const href of links) {
        try {
          const u = new URL(href, page.url());
          if (u.origin !== baseOrigin) continue;
          if (!visited.has(u.pathname)) queue.push({ route: u.pathname, depth: depth + 1 });
        } catch {}
      }
    }

    return { pages: Array.from(visited.values()), warnings };
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test scan/crawl
```

Expected: PASS within 60s. Crawler logs in and BFS-discovers `/login`, `/dashboard`, `/profile`.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/scan/crawl.ts packages/cli/tests/scan/crawl.test.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(scan): Playwright crawler with optional login + action hints"
```

---

## Task 13: Scan — reconciler

**Files:**
- Create: `packages/cli/src/scan/reconcile.ts`
- Test: `packages/cli/tests/scan/reconcile.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/scan/reconcile.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { reconcile } from "../../src/scan/reconcile.js";

const routes = [
  { path: "/login", element: "Login" },
  { path: "/dashboard", element: "Dashboard" },
  { path: "/profile", element: "Profile" }
];

const crawl = {
  pages: [
    { route: "/login", title: "Sign in", primary_actions: [{ selector: "[data-test=submit]", label: "Sign in", kind: "submit" as const }] },
    { route: "/dashboard", title: "Dashboard", primary_actions: [] },
    { route: "/profile", title: "Profile", primary_actions: [] }
  ],
  warnings: []
};

const graph = {
  nodes: [
    { id: "n1", label: "Login::default", file: "src/pages/Login.tsx", kind: "function" },
    { id: "n2", label: "Dashboard::default", file: "src/pages/Dashboard.tsx", kind: "function" },
    { id: "n3", label: "Profile::default", file: "src/pages/Profile.tsx", kind: "function" }
  ],
  links: [{ source: "n2", target: "n3" }],
  warnings: []
};

describe("reconcile", () => {
  it("merges all three sources into PageEntry array", () => {
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl, graph });
    expect(r.pages).toHaveLength(3);
    const dash = r.pages.find(p => p.route === "/dashboard")!;
    expect(dash.title).toBe("Dashboard");
    expect(dash.graph_node).toBe("n2");
  });

  it("flags route present in code but not crawled", () => {
    const orphan = [...routes, { path: "/legacy", element: "Legacy" }];
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes: orphan, crawl, graph });
    expect(r.warnings.some(w => w.code === "route-not-mounted")).toBe(true);
  });

  it("flags page crawled but not in router config", () => {
    const extraCrawl = { ...crawl, pages: [...crawl.pages, { route: "/admin", title: "Admin", primary_actions: [] }] };
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl: extraCrawl, graph });
    expect(r.warnings.some(w => w.code === "crawled-not-routed")).toBe(true);
  });

  it("computes importance from graph hub-score", () => {
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl, graph });
    const dash = r.pages.find(p => p.route === "/dashboard")!;
    const profile = r.pages.find(p => p.route === "/profile")!;
    expect(dash.importance).toBeGreaterThanOrEqual(profile.importance);
  });

  it("requires_auth=true when login redirect detected", () => {
    const authCrawl = { ...crawl, warnings: [{ code: "redirect-to-login", message: "/dashboard redirected to /login" }] };
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl: authCrawl, graph });
    expect(r.pages.find(p => p.route === "/dashboard")?.requires_auth).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli test scan/reconcile
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scan/reconcile.ts`**

```typescript
import type { Framework, PageEntry, ScanResult, Warning, FlowEntry } from "./types.js";
import type { RouteEntry } from "./routes/index.js";
import type { CrawlResult } from "./crawl.js";
import type { GraphResult } from "./graph.js";

export interface ReconcileInput {
  framework: Framework;
  baseUrl: string;
  routes: RouteEntry[];
  crawl: CrawlResult;
  graph: GraphResult;
}

function routeToId(path: string): string {
  return path === "/" ? "root" : path.replace(/^\//, "").replace(/[\/:]/g, "-");
}

function mapElementToFile(routes: RouteEntry[], graph: GraphResult): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of routes) {
    if (!r.element) continue;
    const node = graph.nodes.find((n) => n.label.startsWith(r.element + "::") || n.label.includes(`/${r.element}.`));
    if (node) map.set(r.path, node.file);
  }
  return map;
}

function deriveFlows(pages: PageEntry[], graph: GraphResult): FlowEntry[] {
  const byNode = new Map(pages.filter((p) => p.graph_node).map((p) => [p.graph_node!, p]));
  const adj = new Map<string, string[]>();
  for (const link of graph.links) {
    if (!byNode.has(link.source) || !byNode.has(link.target)) continue;
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push(link.target);
  }
  const flows: FlowEntry[] = [];
  for (const [source, targets] of adj) {
    const sourcePage = byNode.get(source)!;
    for (const target of targets) {
      const targetPage = byNode.get(target)!;
      flows.push({
        id: `${sourcePage.id}-to-${targetPage.id}`,
        name: `${sourcePage.title} → ${targetPage.title}`,
        page_ids: [sourcePage.id, targetPage.id]
      });
    }
  }
  return flows;
}

function extractRouteFromAuthWarning(msg: string): string | null {
  const m = msg.match(/^(\/[^\s]+) redirected/);
  return m ? m[1] : null;
}

export function reconcile(input: ReconcileInput): ScanResult {
  const warnings: Warning[] = [...input.crawl.warnings, ...input.graph.warnings];
  const crawled = new Map(input.crawl.pages.map((p) => [p.route, p]));
  const routed = new Map(input.routes.map((r) => [r.path, r]));

  for (const [path] of routed) {
    if (!crawled.has(path)) {
      warnings.push({ code: "route-not-mounted", message: `route ${path} declared in router but not reachable during crawl` });
    }
  }
  for (const [route] of crawled) {
    if (!routed.has(route)) {
      warnings.push({ code: "crawled-not-routed", message: `crawler reached ${route} but no matching route declared` });
    }
  }

  const authRoutes = new Set(
    input.crawl.warnings
      .filter((w) => w.code === "redirect-to-login")
      .map((w) => extractRouteFromAuthWarning(w.message))
      .filter((s): s is string => s !== null)
  );

  const filesByPath = mapElementToFile(input.routes, input.graph);
  const inboundCounts = new Map<string, number>();
  for (const link of input.graph.links) {
    const targetNode = input.graph.nodes.find((n) => n.id === link.target);
    if (!targetNode) continue;
    inboundCounts.set(targetNode.file, (inboundCounts.get(targetNode.file) ?? 0) + 1);
  }

  const pages: PageEntry[] = [];
  for (const r of input.routes) {
    const c = crawled.get(r.path);
    const file = filesByPath.get(r.path);
    const graphNode = file ? input.graph.nodes.find((n) => n.file === file)?.id : undefined;
    const importance = file ? inboundCounts.get(file) ?? 0 : 0;
    pages.push({
      id: routeToId(r.path),
      route: r.path,
      title: c?.title ?? r.element ?? r.path,
      graph_node: graphNode,
      primary_actions: c?.primary_actions ?? [],
      requires_auth: authRoutes.has(r.path),
      needs_seed: false,
      importance
    });
  }

  return {
    framework: input.framework,
    base_url: input.baseUrl,
    pages,
    flows: deriveFlows(pages, input.graph),
    warnings
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @tutorialvid/cli test scan/reconcile
```

Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/scan/reconcile.ts packages/cli/tests/scan/reconcile.test.ts
git commit -m "feat(scan): reconciler merges routes + crawl + graph into ScanResult"
```

---

## Task 14: Scan — orchestrator + CLI subcommand wiring

**Files:**
- Create: `packages/cli/src/scan/index.ts`
- Create: `packages/cli/src/commands/scan.ts`
- Modify: `packages/cli/src/index.ts` — replace stub action
- Test: `packages/cli/tests/e2e/scan.test.ts`

- [ ] **Step 1: Write E2E failing test**

Create `packages/cli/tests/e2e/scan.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { readdir } from "node:fs/promises";

let server: ResultPromise | undefined;
const fixtureRoot = resolve(__dirname, "../../../../fixtures/sample-app");

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: {
    mode: "waterfall",
    credentials: {
      username_env: "TV_USER",
      password_env: "TV_PASS",
      username_selector: "[data-test=username]",
      password_selector: "[data-test=password]",
      submit_selector: "[data-test=submit]",
      login_url: "/login"
    }
  },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" }
};

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("sample-app dev server did not start");
}, 60_000);

afterAll(() => server?.kill("SIGTERM"));

describe("e2e: tutorialvid scan", () => {
  it("produces a valid scan.json against the fixture sample-app", async () => {
    const target = mkdtempSync(join(tmpdir(), "tv-e2e-scan-"));
    mkdirSync(join(target, ".tutorialvid"));
    writeFileSync(join(target, ".tutorialvid", "config.json"), JSON.stringify(config));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

    const cliBin = resolve(__dirname, "../../bin/tutorialvid");
    const { exitCode, stderr } = await execa("node", [cliBin, "scan", "--cwd", target], {
      env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" },
      reject: false
    });
    expect(exitCode, stderr).toBe(0);

    const scanFiles = await readdir(join(target, ".tutorialvid/cache/scan"));
    expect(scanFiles).toHaveLength(1);
    const scan = JSON.parse(readFileSync(join(target, ".tutorialvid/cache/scan", scanFiles[0]), "utf8"));
    expect(scan.framework).toBe("react-router");
    expect(scan.pages.map((p: { route: string }) => p.route).sort()).toEqual(
      expect.arrayContaining(["/dashboard", "/login", "/profile"])
    );
  }, 90_000);
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

```bash
pnpm --filter @tutorialvid/cli build
pnpm --filter @tutorialvid/cli test e2e/scan
```

Expected: FAIL — scan command stub still exits with code 2.

- [ ] **Step 3: Implement `scan/index.ts`**

```typescript
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { detectFramework } from "./framework.js";
import { parseRoutes } from "./routes/index.js";
import { crawl, type CrawlAuth } from "./crawl.js";
import { readGraph } from "./graph.js";
import { reconcile } from "./reconcile.js";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { ScanResult } from "./types.js";
import { logger } from "../logger.js";

async function resolveAuth(config: Config): Promise<CrawlAuth | undefined> {
  const c = config.auth.credentials;
  if (!c) return undefined;
  const username = process.env[c.username_env];
  const password = process.env[c.password_env];
  if (!username || !password) {
    logger.warn(
      { username_env: c.username_env, password_env: c.password_env },
      "credentials env vars not set; crawling without auth"
    );
    return undefined;
  }
  return {
    loginUrl: c.login_url,
    usernameSelector: c.username_selector,
    passwordSelector: c.password_selector,
    submitSelector: c.submit_selector,
    username,
    password
  };
}

async function computeScanHash(projectRoot: string, config: Config): Promise<string> {
  let gitSha = "no-git";
  try {
    const { stdout } = await execa("git", ["rev-parse", "HEAD"], { cwd: projectRoot });
    gitSha = stdout.trim();
  } catch {}
  let lockSha = "no-lock";
  for (const lockName of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
    try {
      const buf = await readFile(join(projectRoot, lockName));
      lockSha = createHash("sha256").update(buf).digest("hex").slice(0, 16);
      break;
    } catch {}
  }
  return hashInputs({ gitSha, lockSha, dev_url: config.app.dev_url });
}

export async function runScan(projectRoot: string, config: Config): Promise<{ result: ScanResult; hash: string }> {
  const framework = await detectFramework(projectRoot, config.app.framework_hint);
  logger.info({ framework }, "framework detected");
  const [routes, graph] = await Promise.all([parseRoutes(framework, projectRoot), readGraph(projectRoot)]);
  let crawlResult;
  try {
    const auth = await resolveAuth(config);
    crawlResult = await crawl({ baseUrl: config.app.dev_url, maxDepth: 3, auth });
  } catch (err) {
    logger.warn({ err }, "crawl failed; proceeding with empty crawl");
    crawlResult = { pages: [], warnings: [{ code: "crawl-failed", message: (err as Error).message }] };
  }
  const result = reconcile({ framework, baseUrl: config.app.dev_url, routes, crawl: crawlResult, graph });
  const hash = await computeScanHash(projectRoot, config);
  return { result, hash };
}
```

- [ ] **Step 4: Implement `commands/scan.ts`**

```typescript
import { runScan } from "../scan/index.js";
import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { logger } from "../logger.js";

export interface ScanCommandOpts { cwd: string; }

export async function scanCommand(opts: ScanCommandOpts): Promise<number> {
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
  const { result, hash } = await runScan(projectRoot, config);
  const target = paths.scan(hash);
  const existing = await store.readJson(target);
  if (existing) {
    logger.info({ target }, "scan cache hit");
  } else {
    await store.writeJson(target, result);
    logger.info({ target, pages: result.pages.length, warnings: result.warnings.length }, "scan written");
  }
  await sm.markStageComplete("scan");
  return 0;
}
```

- [ ] **Step 5: Wire scan command in `src/index.ts`**

Replace the existing `scan` action with:

```typescript
program
  .command("scan")
  .description("Reconcile code-graph + routes + crawl into a scan.json")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { scanCommand } = await import("./commands/scan.js");
    const code = await scanCommand({ cwd: opts.cwd });
    process.exit(code);
  });
```

- [ ] **Step 6: Build + run E2E test**

```bash
pnpm --filter @tutorialvid/cli build
pnpm --filter @tutorialvid/cli test e2e/scan
```

Expected: PASS within 90s. Cache file under `.tutorialvid/cache/scan/<hash>.json` contains 3 pages.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/scan/index.ts packages/cli/src/commands packages/cli/src/index.ts packages/cli/tests/e2e/scan.test.ts
git commit -m "feat(cli): wire end-to-end scan command — produces scan.json"
```

---

## Task 15: Plugin skeleton — `tutorialvid-create` skill + slash command

**Files:**
- Create: `packages/plugin/.claude-plugin/plugin.json`
- Create: `packages/plugin/skills/tutorialvid-create/SKILL.md`
- Create: `packages/plugin/commands/tutorialvid.md`
- Create: `packages/plugin/package.json`
- Create: `packages/plugin/README.md`

- [ ] **Step 1: `packages/plugin/package.json`**

```json
{
  "name": "@tutorialvid/plugin",
  "version": "0.0.1",
  "description": "TutorialVid Claude Code plugin (orchestrator)",
  "license": "MIT",
  "private": false,
  "files": [".claude-plugin", "skills", "commands", "agents", "README.md"],
  "scripts": {
    "lint": "echo 'no JS to lint' && exit 0",
    "test": "echo 'no plugin unit tests in plan-1' && exit 0",
    "typecheck": "echo 'no TS in plugin' && exit 0",
    "build": "echo 'plugin is content-only' && exit 0"
  }
}
```

- [ ] **Step 2: `.claude-plugin/plugin.json`**

```json
{
  "name": "tutorialvid",
  "version": "0.0.1",
  "description": "Turn a running vibe-coded web app into a polished tutorial video.",
  "skills": ["tutorialvid-create"],
  "commands": ["tutorialvid"]
}
```

- [ ] **Step 3: `packages/plugin/skills/tutorialvid-create/SKILL.md`**

```markdown
---
name: tutorialvid-create
description: Use when the user wants to create a tutorial video for their running web app. Drives the TutorialVid pipeline: scan → plan → script → tts → record → compose → finalize, with user-review gates between stages. Requires `@tutorialvid/cli` installed and a Gemini API key.
---

# tutorialvid-create

Walk the user through producing a tutorial video for their vibe-coded web app.

## Prerequisites

Before doing anything else, verify:

1. `tutorialvid` CLI is on PATH. Run `tutorialvid --version`. If missing, tell the user: `npm i -g @tutorialvid/cli`.
2. Project root contains `.tutorialvid/config.json`. If missing, generate one.
3. `GEMINI_API_KEY` env var is set. If missing, ask the user to set it before any TTS step.
4. Dev server is reachable at `config.app.dev_url`.

## Plan-1 capability

This skill currently supports **only the scan stage**. Later stages will land in subsequent plugin versions.

Run:

```bash
tutorialvid scan --cwd <project-root>
```

Then read `<project-root>/.tutorialvid/cache/scan/<hash>.json` and present a short summary to the user:

- Framework detected
- Number of pages discovered
- Top 5 pages by importance score
- Any warnings

## Config bootstrap

If `.tutorialvid/config.json` is absent, gather these values interactively and write the file. Use `packages/cli/src/config/schema.ts` as the source of truth.

## What this skill must NOT do

- Manipulate mp4 or audio bytes directly.
- Hardcode credentials. Always reference env vars by name.
- Skip cache-hit messaging. If the CLI says "cache hit", tell the user.
```

- [ ] **Step 4: `packages/plugin/commands/tutorialvid.md`**

```markdown
---
description: Create a tutorial video for the current web app project (scan stage in v0.0.1).
---

You are running the `tutorialvid-create` skill. Invoke that skill now and follow it.

Project root: $CWD

User's optional intent or note: $ARGUMENTS
```

- [ ] **Step 5: `packages/plugin/README.md`**

```markdown
# @tutorialvid/plugin

Claude Code plugin that orchestrates the TutorialVid pipeline.

## Installation

In Claude Code, install via the plugin's repository URL or marketplace listing.

## Requirements

- `@tutorialvid/cli` installed and on PATH
- `GEMINI_API_KEY` env var (required at the TTS stage)
- A vibe-coded web app with a reachable dev server

## v0.0.1 scope

- Slash command `/tutorialvid` triggers the skill
- Skill drives `tutorialvid scan` and summarizes the result
```

- [ ] **Step 6: Verify plugin manifest is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/plugin/.claude-plugin/plugin.json','utf8')); console.log('plugin.json valid')"
```

Expected: prints `plugin.json valid`.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin
git commit -m "feat(plugin): scaffold @tutorialvid/plugin with scan-only skill"
```

---

## Task 16: Wire root scripts + final verification

**Files:**
- Modify: `package.json` (root) — add `scan:fixture` script
- Create: `packages/cli/scripts/run-fixture-scan.ts`
- Create: `docs/manual-test-checklist.md`

- [ ] **Step 1: Add `scan:fixture` convenience script**

In root `package.json` add to `"scripts"`:

```json
"scan:fixture": "tsx packages/cli/scripts/run-fixture-scan.ts"
```

Add `tsx` as root devDep:

```bash
pnpm add -D -w tsx
```

- [ ] **Step 2: Create `packages/cli/scripts/run-fixture-scan.ts`**

```typescript
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { setTimeout as wait } from "node:timers/promises";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, "../../../fixtures/sample-app");
const cliBin = resolve(here, "../bin/tutorialvid");

const config = {
  version: 1,
  app: { name: "Sample", dev_url: "http://localhost:5173", start_server: false, framework_hint: "react-router" },
  auth: {
    mode: "waterfall",
    credentials: {
      username_env: "TV_USER",
      password_env: "TV_PASS",
      username_selector: "[data-test=username]",
      password_selector: "[data-test=password]",
      submit_selector: "[data-test=submit]",
      login_url: "/login"
    }
  },
  render: { resolution: "1920x1080", fps: 30, max_total_duration_s: 900, max_segment_duration_s: 240 },
  tts: { provider: "gemini", api_key_env: "GEMINI_API_KEY", language: "en-US" }
};

const tmp = mkdtempSync(join(tmpdir(), "tv-scan-fixture-"));
mkdirSync(join(tmp, ".tutorialvid"));
writeFileSync(join(tmp, ".tutorialvid", "config.json"), JSON.stringify(config, null, 2));
writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "x", dependencies: { "react-router-dom": "^7.0.0" } }));
mkdirSync(join(tmp, "src"));
writeFileSync(join(tmp, "src/router.tsx"), readFileSync(join(fixtureRoot, "src/router.tsx"), "utf8"));

console.log(`fixture scan working dir: ${tmp}`);

const server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], { stdout: "ignore", stderr: "ignore" });
try {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) break; } catch {}
    await wait(500);
  }
  await execa("node", [cliBin, "scan", "--cwd", tmp], {
    stdio: "inherit",
    env: { ...process.env, TV_USER: "demo", TV_PASS: "demo" }
  });
  console.log(`scan complete: ls ${join(tmp, ".tutorialvid/cache/scan")}`);
} finally {
  server.kill("SIGTERM");
}
```

- [ ] **Step 3: Run all CLI tests**

```bash
pnpm --filter @tutorialvid/cli test
```

Expected: all tests pass (cache, state, config, scan/framework, scan/routes, scan/graph, scan/crawl, scan/reconcile, e2e/scan, cli help).

- [ ] **Step 4: Run convenience scan against fixture**

```bash
pnpm scan:fixture
```

Expected: prints fixture scan working dir, scan complete, and `scan/<hash>.json` exists.

- [ ] **Step 5: Create manual test checklist**

Create `docs/manual-test-checklist.md`:

```markdown
# TutorialVid — Manual test checklist

## Plan 1 acceptance: foundation + scan

- [ ] `tutorialvid --version` prints `0.0.1`.
- [ ] `tutorialvid --help` lists a `scan` command.
- [ ] In a project with `react-router-dom` and a dev server on port 5173, running `tutorialvid scan` produces `.tutorialvid/cache/scan/<hash>.json` with `framework: "react-router"`.
- [ ] Re-running `tutorialvid scan` with no code changes logs `cache hit` and does not rewrite the file.
- [ ] Modifying a route file then re-running `tutorialvid scan` produces a new hash and a new file.
- [ ] When `GEMINI_API_KEY` is unset, scan still succeeds (TTS not invoked at this stage).
- [ ] When credentials env vars are unset, scan logs a warning and crawls without auth.
- [ ] In Claude Code, `/tutorialvid` invokes the `tutorialvid-create` skill, which calls the CLI and reports framework + page count + top-5 pages by importance.
```

- [ ] **Step 6: Commit**

```bash
git add packages/cli/scripts package.json pnpm-lock.yaml docs/manual-test-checklist.md
git commit -m "chore: add scan:fixture convenience script + manual test checklist"
```

---

## Task 17: Plan-1 wrap-up

- [ ] **Step 1: Tag 0.0.1**

```bash
git tag -a v0.0.1-plan1 -m "Plan 1 complete: foundation + scan"
```

- [ ] **Step 2: Update Vault session log**

Append a closing section to `Vault/10-Sessions/2026/05/2026-05-02-tutorialvid-brainstorm.md` (or create a new dated session note) summarizing what shipped and which file paths to revisit when Plan 2 begins.

- [ ] **Step 3: Commit**

```bash
git add Vault/
git commit -m "docs(vault): record plan-1 completion"
```

Plan 2 (Plan + Script stages) is written separately after Plan 1 ships and is reviewed in the running fixture.

---

## Self-review (writing-plans skill)

**Spec coverage** — Plan 1 covers spec §3 (architecture overview), §4.1 (`scan/`), §4.8 (`cache/` + `state/`), §6 (cache + idempotency invariants), §7.1 (config schema, partial — only scan-relevant fields exercised), §10 partial (selector flakiness deferred until record stage). All other spec sections (§4.2–4.7, §8 gates, §9 depth/tone, §11 testing strategy beyond CLI unit + E2E) are explicitly deferred to Plans 2–5 in the milestone table at the top.

**Placeholder scan** — no "TBD" / "TODO" / "implement later" / "similar to Task N" patterns remain. The MCP-bridge variant of the graph reader is *explicitly* deferred to Plan 2 with a one-sentence rationale; that's a scope decision, not a placeholder.

**Type consistency** —
- `Stage` includes `"final"` (used in `state/machine.ts`); spec §10 distinguishes `compose` and `final` so both are listed.
- `cachePaths.script(segmentId, hash, ext)` signature matches the test in Task 4.
- `RouteEntry { path, element? }` is shared between `scan/routes/react-router.ts` and `scan/reconcile.ts` via `scan/routes/index.ts` re-export.
- `CrawlResult` in `crawl.ts` matches what `reconcile()` consumes.
- `ScanResult` in `types.ts` matches what `runScan()` returns and what the E2E test asserts.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-tutorialvid-plan-1-foundation-and-scan.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
