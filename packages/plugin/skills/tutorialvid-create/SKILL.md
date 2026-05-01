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

`tutorialvid scan --cwd <project-root>`

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
