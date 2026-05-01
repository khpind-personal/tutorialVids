---
title: TutorialVid — Design Spec (Phase 1)
date: 2026-05-02
status: draft
type: spec
---

> **Canonical copy:** `docs/specs/2026-05-02-tutorialvid-design.md`
> This vault note mirrors that file. When editing, update both.

See `../../docs/specs/2026-05-02-tutorialvid-design.md` for full content.

## TL;DR

A Claude Code plugin that turns a running vibe-coded web app into a polished tutorial video, with optional Phase-2 re-cut into a short marketing video.

- **Architecture:** thin Claude skill + Node CLI engine (`tutorialvid`) + 2 subagents (script writer, scene director).
- **Pipeline:** scan → plan → script → TTS → record (Playwright) → compose (Remotion + ffmpeg) → finalize.
- **User control:** 4 review gates; content-hashed cache; per-segment surgical re-run.
- **Output:** 1080p30 mp4 + sidecar SRT + per-segment artifacts kept for Phase 2.

## Locked decisions

See [[../../20-Decisions/2026-05-02-tutorialvid-architecture|architecture decisions]] for the full list.

## Status

- [x] Brainstorm complete
- [x] Design spec written
- [ ] User review of spec
- [ ] Implementation plan
- [ ] Phase 1 build
- [ ] Phase 1 ship
- [ ] Phase 2 spec
