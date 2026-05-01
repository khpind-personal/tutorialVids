---
title: TutorialVid — Architecture decisions
date: 2026-05-02
status: active
type: decision
tags: [architecture, plugin, video, playwright, remotion, gemini-tts]
---

# TutorialVid — Architecture decisions (2026-05-02)

Decisions locked during the 2026-05-02 brainstorm. See [[../50-Product/specs/2026-05-02-tutorialvid-design|design spec]] for full reasoning.

| # | Topic | Decision |
|---|-------|----------|
| 1 | Platform scope | Web-only v1. Mobile responsive deferred. Native mobile, CLI-tool tutorials out of scope. |
| 2 | Tool understanding | Hybrid scan: code-review-graph + framework route parser + Playwright crawl, reconciled into one map. |
| 3 | Auth | Waterfall A → B → C: credentials-driven login (recommended), storage-state import, inline-shown login. Explicit token-cost warning on B and C. |
| 4 | Depth levels | Low (20–40s, what+where), Medium (60–90s, +why), High (2–4min, +edge cases + tips). |
| 5 | Seed data | Optional. Plugin warns if empty-state detected on a page. |
| 6 | Tone presets | 5 in v1: Friendly Guide, Pro/Concise, Hype/Launch, Founder POV, Documentary. English-only. Gemini TTS. |
| 7 | Composer | Playwright (raw recording) + Remotion (compositor) hybrid. Captions burned-in + sidecar SRT. |
| 8 | Cursor | Track-based Remotion overlay (no DOM injection). Click ripple, idle hide, per-tone style. |
| 9 | Runtime | Thin Claude skill (UX) + Node CLI (engine). JSON files + exit codes between them. |
| 10 | Review gates | 4 gates: Plan (ON), Script (ON), Recording (opt-in), Final draft (ON). Per-segment redo. |
| 11 | Scene direction | Hybrid: rule-based defaults + LLM overrides scaled by depth. |
| 12 | Cache | Content-hashed filesystem tree under `.tutorialvid/cache/`. Cascade invalidation. Resumable via `state.json`. |
| 13 | Output | 1080p30 default, configurable. 15min total cap, 4min segment cap. User-supplied branding with fallback templates. |
| 14 | Music | 5 license-free per-tone tracks bundled + user override. Watermark on draft preview. |
| 15 | Runtime concerns | Dev-server probe + opt-in start. Selector retry 3x. Auth re-recovery on expiry. Telemetry off by default. |
| 16 | Phasing | Phase 1 = tutorial creation. Phase 2 = marketing distillation, separate spec. Phase 1 emits compatible artifacts (highlight_score, raw clips, separate audio tracks, safe-zone framing). |

## Rejected alternatives

- **Skill-only runtime** (no CLI): rejected — long renders block the conversation, no resume, no parallelism.
- **MCP-server runtime**: rejected — MCP not yet ideal for long-running jobs with streamed progress.
- **ffmpeg-only composer**: rejected — zoom and animation expressivity too limited.
- **DOM-injected cursor**: rejected — pollutes the recorded app's behavior (z-index, hover bugs).
- **Routes-only scan**: rejected — misses dynamic routes and runtime mounting reality.
- **Pure crawl scan**: rejected — no semantic understanding (which page does X for persona Y).

## Why each rejected option matters

The CLI/skill split is the load-bearing one. If we collapse it back into a skill, we lose resume + cache + parallelism + standalone debugging — all of which are core to the cost-controlled UX of "edit one segment, re-render only that".
