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

## Capability (v0.0.2)

The pipeline now supports three stages: **scan → plan → script**. Each ends at a user-review gate.

### Flow

1. **Scan** (Plan 1):
   `tutorialvid scan --cwd <project-root>`
   Reads `<project-root>/.tutorialvid/cache/scan/<hash>.json` and present:
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

## Config bootstrap

If `.tutorialvid/config.json` is absent, gather these values interactively and write the file. Use `packages/cli/src/config/schema.ts` as the source of truth.

## What this skill must NOT do

- Manipulate mp4 or audio bytes.
- Hardcode API keys.
- Skip cache-hit messaging — if the CLI logs `cache hit`, tell the user (no token spend on that artifact).
- Run `script` without an `ANTHROPIC_API_KEY` set — surface the clear error message to the user instead.
