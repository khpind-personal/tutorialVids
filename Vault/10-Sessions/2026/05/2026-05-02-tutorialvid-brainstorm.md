---
title: TutorialVid — Brainstorm session
date: 2026-05-02
status: draft
type: session
tags: [brainstorm, plugin, video]
---

# TutorialVid — Brainstorm (2026-05-02)

Initial design session. Started in SW Workflows project; carved out into a dedicated `TutorialVid/` project per user direction.

## Context

User wants a Claude Code plugin that lets a single vibe coder go from a working app to a polished tutorial video, and later re-cut into a marketing video. No video-editing skills required from the user.

## What was decided

15 questions answered, all locked. See [[../../../20-Decisions/2026-05-02-tutorialvid-architecture|architecture decisions]].

Key shape:
- Two artifacts: thin Claude skill + Node CLI engine.
- Pipeline: scan → plan → script → TTS → record → compose → finalize.
- 4 review gates, content-hashed cache, per-segment redo.
- Phase 1 = tutorial. Phase 2 = marketing re-cut.

## Spec

[[../../../50-Product/specs/2026-05-02-tutorialvid-design|Phase 1 design spec]] (canonical at `docs/specs/2026-05-02-tutorialvid-design.md`).

## Next

1. ~~User reviews spec.~~ Approved.
2. ~~Invoke `superpowers:writing-plans` to produce implementation plan.~~ Plan 1 written: `docs/plans/2026-05-02-tutorialvid-plan-1-foundation-and-scan.md` (17 tasks, TDD-style).
3. Execute Plan 1 — recommended via `superpowers:subagent-driven-development`.
4. After Plan 1 ships, write Plan 2 (Plan+Script + Gates 1–2).
5. Continue through Plans 3–5.

## Notes for future sessions

- Project lives at `/Users/hariprasadk/Documents/TutorialVid/`.
- Memory at `/Users/hariprasadk/.claude/projects/-Users-hariprasadk-Documents-TutorialVid/memory/`.
- `code-review-graph` MCP and `graphify` are reused from SW Workflows tooling — they apply to vibe-coded *target* apps as well, not just the plugin's own codebase.
- Existing `~/.claude/plugins/whiteboard-brainstorm/` is the closest pattern reference for the plugin layout.

## Plan 1 shipped — 2026-05-02

All 17 tasks complete. 18 commits on `main`, tagged `v0.0.1-plan1`.

### What shipped
- pnpm workspace monorepo with TypeScript strict mode.
- `@tutorialvid/cli` package: cache (hash + paths + store), state machine, Zod config schema + loader, scan pipeline (framework detector + RR7 routes parser + graphify CLI bridge + Playwright crawler + reconciler), scan orchestrator + CLI command wiring.
- `@tutorialvid/plugin` skeleton: SKILL.md for `tutorialvid-create`, slash command `/tutorialvid`, plugin.json manifest.
- `fixtures/sample-app`: Vite + React Router 7 + auth, used by integration + E2E tests.
- 43+ passing tests across unit (cache, state, config, scan/*) + integration (crawl) + E2E (full scan command).

### File paths to revisit for Plan 2 (Plan + Script stages + Gates 1–2)
- `packages/cli/src/commands/` — add `plan.ts`, `script.ts`.
- `packages/cli/src/plan/` — module picker, plan.json emitter.
- `packages/cli/src/script/` — script-writer subagent dispatch + scene-director subagent dispatch.
- `packages/plugin/agents/tutorialvid-script-writer.md` and `tutorialvid-scene-director.md`.
- `packages/plugin/skills/tutorialvid-create/SKILL.md` — extend Plan-1 capability section.

### Open follow-ups
- Replace graphify CLI bridge with code-review-graph MCP transport when reliability of the MCP option is confirmed.
- Action selector heuristic in crawler is intentionally minimal; expand in Plan 2 if scenes need richer hints.
- Strict-mode bug fixed in route parser (`fix(scan): handle noUncheckedIndexedAccess in route regex match`) was caught only at build time of Task 12 — consider adding `pnpm typecheck` to Task 1 of future plans.
