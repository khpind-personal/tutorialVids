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

## Plan 2 shipped — 2026-05-02

13 tasks. Tag `v0.0.2-plan2`.

### What shipped on top of Plan 1
- Anthropic SDK dispatcher with prompt caching + retry
- Plugin agents `tutorialvid-script-writer` + `tutorialvid-scene-director` (frontmatter + system prompt)
- `tutorialvid plan` command — scan + user choices → plan.json + Gate 1 markdown
- `tutorialvid script` command — parallel per-segment fan-out via Anthropic, writes scene.json/txt/ssml per segment
- Skill extended with Plan + Script gates
- Vitest fileParallelism disabled (port 5173 collision fix)

### Plan 3 starting points
- `packages/cli/src/tts/` — Gemini adapter with chunked SSML synthesis + per-word timing emit
- `packages/cli/src/record/` — Playwright runner consuming scene.json + cursor track emitter + auth waterfall A→B→C
- Add `cache/script/<id>/<hash>.{mp3,timing.json}` artifacts under tts.
- Wire Gate 3 (recording opt-in) into the skill.

## Plan 3 shipped — 2026-05-02

13 tasks. Tag `v0.0.3-plan3`.

### What shipped on top of Plan 2
- Gemini TTS adapter (chunked SSML, voice + speed per tone, mp3 + heuristic timing)
- TTS chunker + voice resolver (modular, unit-tested)
- `tutorialvid tts` command — per-segment Gemini synthesis, writes mp3 + timing.json
- Record auth waterfall (A creds + B storage state + C inline-stub)
- CursorRecorder (event-based + dedupe identical moves)
- Scene action runner with selector retry + cursor notes on click
- detectAuthExpiry helper (status + login-redirect)
- Gate 3 markdown formatter
- `tutorialvid record` command — Playwright video + cursor track per segment, auth + seed wired
- Skill extended with TTS + Record + Gate 3 (opt-in)

### Plan 4 starting points (compose stage)
- `packages/cli/src/compose/` — Remotion project generator from scene.json + cursor track + audio
- `packages/cli/src/compose/cursor-overlay/` — render cursor as Remotion overlay (per-tone SVG, click ripple, idle hide)
- `packages/cli/src/compose/zoom.ts` — apply scene.zoom directives via CSS transform
- `packages/cli/src/compose/captions.ts` — burn captions from timing.json + emit sidecar SRT
- `packages/cli/src/compose/ffmpeg.ts` — concat segments + intro/outro + duck-mix music
- Wire Gate 4 (final draft preview at 480p watermarked) into the skill

## Plan 4 shipped — 2026-05-02

12 tasks. Tag `v0.0.4-plan4`.

### What shipped on top of Plan 3
- Remotion 4.x integration (CLI gets JSX support via tsconfig)
- 5 Remotion components (CursorOverlay, ZoomLayer, Callout, CaptionBar, SegmentComposition)
- Remotion entrypoint + per-segment renderMedia orchestrator (parallel via p-limit)
- ffmpeg helpers (concat, watermark, duck-mix, downscale) via fluent-ffmpeg + @ffmpeg-installer
- Stitch helpers: intro+outro title cards (ffmpeg drawtext) + concat-with-music
- Compose orchestrator + Gate 4 markdown formatter
- `tutorialvid compose` command — runs full pipeline, emits `cache/final/draft.mp4` (480p watermarked) + `draft.srt`
- Plugin templates: 5 cursor SVGs (per-tone palette), 5 silent mp3 placeholders, intro/outro JSON specs
- Skill v0.0.4 documents all 6 stages + 4 gates

### Plan 5 starting points (finalize + polish)
- `packages/cli/src/commands/finalize.ts` — full HD render (no watermark) + finalize SRT + stage state advance to `final`
- Replace silent mp3 placeholders with 5 real CC0 / royalty-free tracks (Pixabay, Free Music Archive)
- Replace ffmpeg drawtext intro/outro with proper Remotion-rendered animated intros (logo placement, motion)
- Real per-word audio timing via ffprobe (currently even-distribution heuristic)
- Real cursor coords on click events (currently 0,0 placeholder in record/runner.ts)
- Auth mode C (inline tutorial login) — record the login flow as the first segment when this mode is selected
- Telemetry opt-in (already in config; needs sender)
- Error UX polish: format errors as `what happened, why, what to do next` per spec §10

## Plan 5 shipped — 2026-05-02 — PHASE 1 COMPLETE

9 tasks. Tag `v0.1.0-plan5`. Plugin v1.0.0.

### What shipped on top of Plan 4
- ffprobe-derived audio durations (replaces heuristic timing in tts/gemini.ts)
- Real cursor coords on click via Playwright `boundingBox().centre` (replaces 0,0 placeholder)
- Inline-login scene generator (auth mode C — synthesised SceneJson with masked password, no LLM call)
- Error UX: `formatError` + `renderError` produce 3-line ✖/why/next surface; wired into all 6 command catch blocks
- Opt-in telemetry stub (logs structured events when `config.telemetry.enabled`)
- Remotion-rendered animated intro/outro (replaces ffmpeg drawtext)
- `tutorialvid finalize` command — promotes HD stitch to `cache/final/final.mp4` (no watermark) + `cache/final/final.srt`
- Music sourcing guide (`packages/plugin/templates/music/README.md`) for vibe coders to source CC0 tracks

### Phase 1 final summary
- Tags: v0.0.1-plan1, v0.0.2-plan2, v0.0.3-plan3, v0.0.4-plan4, **v0.1.0-plan5**
- Commands: 7 (scan, plan, script, tts, record, compose, finalize)
- Gates: 4 (Plan, Script, Recording opt-in, Final draft)
- Tones: 5 (Friendly, Pro, Hype, Founder, Documentary)
- Depths: 3 (Low, Medium, High)
- Cursor styles: 5 (per-tone SVGs)
- Tests: 124+ across unit + integration + E2E

### Post-v1 (not in Phase 1, future specs)
- **Phase 2: marketing video distillation** — separate spec, consumes Phase 1 outputs (highlight_score, raw clips, separate audio tracks, safe-zone framing) and re-cuts into short-form video.
- Plugin marketplace publication.
- Real CC0 music *files* (placeholders ship; sourcing guide ships).
- Voice cloning for tone-specific narrators.
- Multi-language narration.
- Mobile responsive recording.
- Real-time progress streaming during long renders.
- Inline-login scene routed through script-writer subagent for tone-specific wording.
- Real telemetry network sender (post privacy/legal review).

## Plan 6 shipped — 2026-05-02 — Claude Code subagent dispatch

6 tasks. Tag `v0.1.1-plan6`. Plugin v1.1.0.

### What changed
- Script stage no longer requires a separate `ANTHROPIC_API_KEY` when run from inside Claude Code.
- New CLI commands: `script-prepare` (emit work files) + `script-consume` (read result files + persist).
- Skill orchestrates Task subagent dispatch between prepare and consume.
- `tutorialvid script --standalone` keeps the Anthropic SDK path for CI / headless use.
- No regression: 134 prior tests still pass; +10 new tests for work-io + prepare + consume = 134 total.

### Why this matters
Vibe coder using Claude Code already pays for Anthropic via the subscription. Forcing a second `ANTHROPIC_API_KEY` for the script stage doubled their bill and added friction. Plan 6 inverts: skill is the LLM dispatcher inside Claude Code; CLI is purely engine.
