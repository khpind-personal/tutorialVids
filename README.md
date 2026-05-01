# TutorialVid

A Claude Code plugin that turns a running vibe-coded web app into a polished product tutorial video — with optional re-cut into a short-form marketing video.

> **Status:** design spec drafted (2026-05-02). Implementation not yet started.

## What it does

Given a vibe-coded web app:

1. **Understands the app** — code-review-graph + route parser + Playwright crawl, reconciled into one map.
2. **Lets you pick** what to show: select pages, depth (Low/Medium/High), tone (Friendly / Pro / Hype / Founder / Documentary).
3. **Writes the script** for you (with review gate before TTS spend).
4. **Records the screen** via Playwright with visible cursor, click ripples, zoom on key actions.
5. **Composes the video** with Remotion: cursor overlay, captions, intro/outro, branded colors, license-free music.
6. **Outputs `final.mp4`** (1080p30) plus sidecar SRT.

Re-running with a small edit re-renders only what changed (content-hashed cache).

## Architecture

Two artifacts ship together:

- `@<org>/tutorialvid-plugin` — Claude Code plugin (skills, slash command, subagents).
- `@<org>/tutorialvid-cli` — Node CLI engine (Playwright + Remotion + ffmpeg).

The skill is a thin orchestrator. All long-running work happens in the CLI.

## Project layout

```
TutorialVid/
├── README.md                    — this file
├── CLAUDE.md                    — project instructions for Claude Code
├── docs/
│   └── specs/
│       └── 2026-05-02-tutorialvid-design.md  — canonical spec
├── Vault/                       — durable knowledge layer (Obsidian-ready)
│   ├── 00-Index.md
│   ├── 10-Sessions/
│   ├── 20-Decisions/
│   ├── 30-Mistakes/
│   ├── 50-Product/specs/        — spec mirrors
│   ├── 60-Brainstorming/
│   ├── 70-Ops/
│   ├── 90-Archive/
│   └── 99-Meta/
└── .gitignore
```

## Roadmap

- **Phase 1 (current spec):** tutorial creation pipeline.
- **Phase 2 (later spec):** marketing video distillation from Phase 1 outputs.

## License

MIT (planned).
