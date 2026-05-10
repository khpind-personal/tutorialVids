# TutorialVid

Agentic tutorial pipeline for AI-built products — point it at a running dev server and get one polished 1080p MP4 per persona, with role-aware narration, captions, intro/outro, ducked music, and a 12-rule QC gate. No hand-driving Playwright. No hand-writing scripts.

## The problem

The new generation of builders ship working products in days using Claude Code, Cursor, Antigravity, v0, Bolt — but the moment the product is done, **distribution becomes the bottleneck**. Onboarding tutorials, persona walkthroughs, launch videos, and demo loops still get hand-recorded one role at a time, drift between sessions, go stale on the next release, and silently kill activation. Solo builders spend more time recording tutorials than building features.

TutorialVid was built to close that last-mile gap — turn the running app itself into a deterministic source of truth for product video, the same way CI turned tests into a source of truth for code.

## What it does

Point it at a running dev server, declare your personas (`admin`, `viewer`, `team_member`, `coordinator`…), and it produces one polished 1080p MP4 per role — with role-aware narration, captions, intro/outro, ducked music, and a 12-rule QC gate — without you hand-driving Playwright or hand-writing scripts.

Re-runs are content-hash cached, so a re-recording after a UI tweak only renders what changed.

## How it works — 10-stage pipeline, 5 quality gates

1. **Discovery** — Playwright crawls every route under each persona's auth, captures DOM hash + page actions + heuristic empty-state detection so the pipeline never narrates over an unprimed page.
2. **Plan** — picks (page × role) segments, surfaces empty-state warnings before recording.
3. **Script** — fans out one Claude Code subagent per segment that writes narration and scene actions in a single JSON pass, so voice and on-screen camera focus can't drift.
4. **TTS** — per-beat narration synthesis via Gemini TTS (5 tone presets: Friendly, Pro, Hype, Founder, Documentary).
5. **Pace** — re-grids the visual timeline from measured TTS chunk durations so the visuals land exactly when the narration mentions them.
6. **Record** — Playwright captures per-segment webm + cursor track + live element bounding boxes, so highlights anchor on real on-screen pixels, not stale coordinates.
7. **Compose** — Remotion renders per-segment compositions; ffmpeg stitches the per-role draft.
8. **Verify** (Gate 5, mandatory) — 12-rule QC across A/V sync, narration pacing, zoom abuse, and visual-style locks. Errors block finalize.
9. **Finalize** — promotes the verified stitch to `final.<role>.mp4` in your output dir.

## Why it matters for the builder economy

- **Distribution as code.** Tutorial output is checked into the same workflow as the product. Ship a feature, re-run the pipeline, get a refreshed multi-role video on the next CI tick. No more "I'll record it later."
- **Native to the AI-coding stack.** Ships as a Claude Code plugin (skill, slash command, segment-author subagent) plus a Node CLI. Inside a Claude Code session it dispatches parallel Task subagents to write scripts in seconds — no API key needed, billed via the user's subscription. CI / headless callers fall back to the Anthropic SDK.
- **Determinism + honesty as primitives.** The segment-author refuses to invent activity for empty pages; Gate 5 blocks zoom abuse and audio-overrun bugs that hand-edited tutorials hide. Outputs are reproducible, which makes them safe to embed in onboarding, docs sites, and changelog automation.

## Stack

Node 20 + pnpm · TypeScript · Playwright (discovery + record) · Claude Code subagents (script) · Gemini 2.5 Flash TTS · Remotion + ffmpeg (compose) · Zod-validated config · Vitest. **151 unit + integration tests green on every commit.**

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
├── packages/                    — CLI + plugin source
├── fixtures/                    — sample app for e2e tests
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

- **Now** — `npm publish` for the CLI + Claude Code marketplace entry for the plugin (one-command install).
- **Phase 2** — distill the same pipeline into < 60s social-ready marketing shorts using `highlight_score` + safe-zone framing — closing the loop from "product built" to "product shipped + announced."

## License

MIT (planned).
