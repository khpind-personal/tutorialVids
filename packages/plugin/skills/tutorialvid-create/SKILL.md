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

## Capability (v0.0.4)

Pipeline supports six stages: **scan → plan → script → tts → record → compose**, with Gates 1, 2, 3 (opt-in), and 4.

### Flow

1. **Scan**: `tutorialvid scan --cwd <root>` — list framework, pages, top-5 by importance, warnings.
2. **Plan — Gate 1**: `tutorialvid plan --cwd <root>` — markdown table, user approves/edits.
3. **Script — Gate 2**: `tutorialvid script --cwd <root>` — needs `ANTHROPIC_API_KEY`.
4. **TTS**: `tutorialvid tts --cwd <root>` — needs `GEMINI_API_KEY`. mp3 + timing per segment.
5. **Record — Gate 3 (opt-in)**: `tutorialvid record --cwd <root>` — Playwright video + cursor track + auth waterfall.
6. **Compose — Gate 4**: `tutorialvid compose --cwd <root>` — Remotion per-segment compositions (raw clip + cursor overlay + zoom + callouts + captions + TTS audio) + ffmpeg stitch + intro/outro + duck-mixed music. Outputs `cache/final/draft.mp4` (480p watermarked) + `cache/final/draft.srt` sidecar. Show this to the user before final HD render (Plan 5).

### Auth

- A (recommended): provide login creds via env vars + selectors in `config.auth.credentials`.
- B (extra tokens): export storageState.json once, point `config.auth.storage_state_path` at it.
- C: deferred to Plan 5 (inline tutorial login).

## Config bootstrap

If `.tutorialvid/config.json` is absent, gather these values interactively and write the file. Use `packages/cli/src/config/schema.ts` as the source of truth.

## What this skill must NOT do

- Manipulate mp4 or audio bytes directly outside the CLI.
- Hardcode API keys.
- Run `tts` without `GEMINI_API_KEY`, `record` without successful auth, or `compose` without the prior stages — surface the clear error.
- Enable `gate_3_enabled` by default — only opt-in for High-depth tutorials.
- Ship the watermarked draft as the final video; final HD render is Plan 5's `tutorialvid finalize`.
