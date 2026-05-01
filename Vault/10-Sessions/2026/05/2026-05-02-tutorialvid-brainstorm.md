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
