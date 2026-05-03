# TutorialVid — production-grade evaluation + remaining work (2026-05-04)

## Where we are

Pipeline is functionally complete and proven against WorkBlock end-to-end. Iter-17 ships 1080p tight-paced video with role-aware narration, beat-locked TTS, auto-anchored callouts, parent-traversal selectors, and Gate 5 verify passing 0/0.

**Live at:** `https://github.com/khpind-personal/tutorialVids` (commit `eafb7b0`+)

**Latest output:** `output/workblock-2026-05-03-iter17/` — coordinator dashboard, 56 s, 1080p, 0 errors / 0 warnings on Gate 5.

## Current 10-stage pipeline

```
discovery → scan → plan → script (prepare→subagent→consume) → tts → pace → record → compose → verify → finalize
```

Gates: 0 (discovery) · 1 (plan) · 2 (script) · 3 (recording, opt-in) · 4 (compose draft) · 5 (verify, mandatory).

CLI commands wired:
- `tutorialvid status` ✅ NEW THIS SESSION — shows pipeline progress + next-step hint + env checks
- `tutorialvid discovery|scan|plan|script-prepare|script-consume|tts|pace|record|compose|verify|finalize` ✅
- `tutorialvid script --standalone` (legacy Anthropic SDK fallback) ✅

## Production-grade evaluation (honest)

### What works

| Area | State |
|------|-------|
| 10-stage pipeline | All commands exist + chain. Verified iter-17. |
| Beat-driven TTS | Per-action `narration_phrase` → one mp3 per beat, placed at `action.t_ms`. |
| Pace stage | Re-grids scene from measured chunk durations. iter-17: 75 s → 48 s, silent gap 44 % → 13 %. |
| Verify (Gate 5) | 7 rules. Caught real overlap defect, paced version passes 0/0. |
| Compose | 1080p default, auto-anchor callouts adjacent to spotlight, parent-traversal selectors, live bbox lock. |
| Role-aware | (page × role) segments, per-role storage_state, per-role final drafts. |
| Discovery | Phase 0 with markdown corpus ingest + per-role accessibility crawl. |
| Tests | 132/134 (1 pre-existing fixture-server flake on tests/scan/crawl.test.ts). |

### Gaps blocking "anyone can use it"

P0 (blocks first-time user):
1. **No `tutorialvid init`** — new user has zero onboarding. Today they'd have to manually create `.tutorialvid/config.json`, `tutorialvid.roles.json`, capture per-role storage_state, set `GEMINI_API_KEY`, learn 10 separate subcommands.
2. **No `tutorialvid run` orchestrator** — user runs 10 commands by hand.
3. **Auth capture is manual** — Playwright MCP + JSON dump. Should be `tutorialvid capture-auth --role X` headed-browser flow.
4. **README placeholder** — still says "implementation not yet started" (line 5). Six iterations of code shipped.
5. **Script subagent dispatch isn't auto-looped** — SKILL.md describes the loop but in practice the user (or orchestrating session) drives `Agent()` calls manually each time.

P1 (rough edges):
6. ~~`tutorialvid status`~~ ✅ shipped this session
7. **No `tutorialvid reset --stage X`** — cache invalidation requires `rm -rf`.
8. **Zero tests for new modules** — discovery/, pace/, verify/ are untested. These are the QC core.
9. **Error UX bare** — 3-line format exists but no recovery hints (e.g. "missing tts.timing.json → run `tutorialvid tts`").
10. **Logging dumps raw pino JSON** — should be quiet by default; debug behind `TV_LOG_LEVEL=debug`.

P2 (nice to have):
11. Plugin not on npm/marketplace (`@tutorialvid/cli@0.0.1` local-only).
12. Music templates 1 s placeholders.
13. No example beyond `fixtures/sample-app/`.
14. Telemetry sender stub.

## What was shipped this session

1. `tutorialvid status` command — `packages/cli/src/commands/status.ts` (~190 lines). Tested against `/tmp/tv-workblock-1777704233`. Output:
   - Project path
   - Last command + last completed stage from state.json
   - 10-stage table with ✓ / ◐ / ◯ / · glyphs and per-stage hint
   - Next-step section with the exact command to run
   - Env warnings (e.g. `GEMINI_API_KEY` not set)
2. CLI subcommand registered in `packages/cli/src/index.ts`.
3. Build clean. Tests still 132/134.

## Remaining tasks (queued, not started)

Open in TaskList — see ID 20-28 (status #22 is done):

- 20: `tutorialvid init` — interactive setup wizard
- 21: `tutorialvid capture-auth --role X` — headed login flow
- 23: `tutorialvid run` — orchestrator with auto-gate prompts
- 24: `tutorialvid reset --stage X` — cache invalidation
- 25: Tests for discovery / pace / verify
- 26: Error UX — recovery hints + quieter logs
- 27: Skill auto-loop — segment-author dispatch without manual prompts
- 28: README rewrite — actual state, getting started, examples

## Resume prompt (for fresh session)

```
TutorialVid production-grade hardening, session 2.

Read first:
- /Users/hariprasadk/Documents/TutorialVid/HANDOFF-2026-05-04-prod-grade.md
- ~/.claude/projects/-Users-hariprasadk-Documents-TutorialVid/memory/MEMORY.md

State: 10-stage pipeline functionally complete + iter-17 ships clean (1080p,
beat-locked TTS, paced, verify 0/0). `tutorialvid status` shipped this session.
8 P0/P1 tasks remain — see HANDOFF section "Remaining tasks".

Build order (priority):
1. README rewrite — current README is stale (says "not started"); reflect actual
   iter-17 state + getting-started flow.
2. tutorialvid init — interactive wizard generates .tutorialvid/config.json +
   tutorialvid.roles.json + .gitignore. Detects framework, dev URL, env keys.
3. tutorialvid capture-auth --role X — Playwright headed browser, user logs in,
   dumps storage_state. Replaces manual MCP capture.
4. tutorialvid run [--from <stage>] [--to <stage>] [--yes] — orchestrator.
   Walks stages with gate prompts, dispatches script subagents in skill mode.
5. tutorialvid reset --stage X — drops stage cache + downstream.
6. Tests for discovery / pace / verify (the QC core, currently untested).
7. Error UX — every error gets a `next:` recovery command line. Quieter default
   logs (TV_LOG_LEVEL=debug for current pino dump).
8. Skill auto-loop — SKILL.md should drive segment-author Task dispatch without
   user manually invoking Agent() per segment.

Auto mode on. Caveman mode optional. Project: /Users/hariprasadk/Documents/TutorialVid.
Personal git remote: `personal` → khpind-personal/tutorialVids (push with token
inline; never persist token in .git/config).

Iter-17 reference: output/workblock-2026-05-03-iter17/
Test dir: /tmp/tv-workblock-1777704233/ (cache + roles populated; storage_state
files for coordinator + team_member; coordinator JWT alive ~24 days)
```
