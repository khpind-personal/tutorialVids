# Phase 0 — Discovery + role-aware scripts (2026-05-03 ~03:30 IST)

Layer A (role-aware scripts) and Layer B (writer/director alignment) from the prior handoff are landed and verified end-to-end against WorkBlock.

## What changed

### New stage: `discovery` (Phase 0)

```
discovery → scan → plan → script(prepare/consume) → tts → record → compose → finalize
```

- `tutorialvid discovery --cwd <root> [--routes-from <src>] [--context-dir <path>] [--roles-file <path>]` — Phase 0 stage.
- Reads `tutorialvid.roles.json` (id, label, per-role auth).
- Walks each route under each role in a separate Playwright session.
- Emits `discovery.json` with per-(route × role) DOM hash + nav signature, common pages (identical DOM across roles), and an ingested markdown corpus from `CLAUDE.md` / `README.md` / `docs/` / `--context-dir` paths (capped at 256 KB / 40 files).
- Adds Gate 0 to state machine. Markdown matrix renders per-role accessibility for the user to review.
- `--routes-from` lets the project root (cache + roles + state) live in a different directory from the source tree being parsed (we're using `/tmp/tv-workblock-*` as project root and `buildxv2-frontend` as routes source).
- `--skip-crawl` skips the Playwright pass (offline / test runs).

### Schema additions

- `Segment.role` + `Segment.role_label` + `Segment.is_common`.
- `Plan.roles[]` (mirrors discovery.roles).
- `SceneJson.role` + `is_common`.
- `PageEntry` and `ScanResult` unchanged — discovery's matrix carries per-role data.

### Plan picker now expands segments per role

For each chosen page id:
- If discovery flags the route as `common` (identical DOM across roles), emit ONE segment with `role: "common"`.
- Otherwise emit one segment per role that can access it (`is_common: false`, `role: <id>`, role-specific cache hash).
- Pages a role cannot access are dropped silently.
- `--roles <ids>` filters down to a subset at plan time.
- Segment IDs are now `s01_<page>_<role>` for role-specific and `s01_<page>` for common.

### Writer + director merged → `tutorialvid-segment-author`

Single agent emits narration + scene actions in one JSON pass. Eliminates writer/director drift by construction (the alignment problem that was visible in iter 9 — narration "go to the backlog" while camera zoomed on "Pick Up").

- New plugin agent: `packages/plugin/agents/tutorialvid-segment-author.md`.
- `script-prepare` now emits one `<segment_id>.author.json` work file per segment with embedded `role_view` (role's `unique_elements` + DOM hash + label) plus the discovery `context_corpus`.
- `script-consume` reads `_result/<segment>.author.json` (must include both `narration` and `actions`); writes `<hash>.scene.json` + `.txt` + `.ssml`.
- Old `tutorialvid-script-writer` + `tutorialvid-scene-director` agents kept for the legacy `--standalone` (Anthropic SDK) path; they do not emit role-aware narration. Prefer skill-driven flow.
- Cache hash now includes `role` so two roles for the same page produce distinct cached scenes.

### Per-role record + per-role final assembly

- `record/runner` resolves segment auth from `discovery.roles[segment.role].auth` first, then falls back to project default. Storage state path conventions: `.tutorialvid/storage-state-<role>.json` (cache helper at `cachePaths().storageStateRole(roleId)`).
- `compose/index` groups composed segments by role; common segments are concatenated into every role's stitch in `s##` order. Per-role drafts at `cache/final/draft.<role>.mp4` + `.srt`. Single-role / common-only flows still produce `cache/final/draft.mp4` for back-compat.
- `finalize` walks `_stitch_<role>` dirs and promotes each to `cache/final/final.<role>.mp4`.

## Verification (2026-05-03 ~03:30 IST)

Tested against WorkBlock with `coordinator` + `team_member` roles, real Keycloak storage_state captured for both.

```
$ tutorialvid scan --cwd /tmp/tv-workblock-1777704233 --routes-from /Users/hariprasadk/Documents/buildxv2-frontend
35 pages

$ tutorialvid discovery --cwd /tmp/tv-workblock-1777704233 \
    --routes-from /Users/hariprasadk/Documents/buildxv2-frontend \
    --context-dir /Users/hariprasadk/Documents/buildxv2-frontend/docs
2 roles · 30 routes · 9 context sources · 2 common pages
- /login + /auth/callback flagged common (identical DOM across roles)
- coordinator can access /dashboard, /backlog, /coordinator, /task-roster, ...
- team_member redirected to /login on every protected route in this run
  (likely backend RBAC kick — not a discovery bug; the matrix correctly
  surfaced the access gap)

$ tutorialvid plan --cwd /tmp/tv-workblock-1777704233 --select dashboard,login
2 segments
- s01_dashboard_coordinator (role: Coordinator)
- s02_login (role: common)

$ tutorialvid script-prepare --cwd /tmp/tv-workblock-1777704233
2 work files (one author per segment)
- s01: role_view filled with coordinator's 13 unique nav elements + DOM hash + 172 KB corpus
- s02: role_view: null, is_common: true
```

Build clean. Tests 133/134 pass — the 1 failure is the pre-existing Playwright fixture-server flake on `tests/scan/crawl.test.ts` (port 5173 race), not a regression from this work.

## Open

- `team_member` couldn't reach `/dashboard` in the live discovery crawl — JWT was fresh and worked when I logged in via Playwright MCP, but the headless crawl hit `/login` redirect. Likely an RBAC interceptor that kicks unrecognized roles. Worth reproducing manually before assuming the access matrix is wrong; the architecture is sound.
- TTS quota (Gemini 2.5 Flash Preview free tier) still blocks a full 5-segment compose pass. Unchanged — Issue 2 from prior handoff.
- Real script-consume + tts + record + compose loop wasn't run end-to-end here; the skill's subagent dispatch + Gemini quota + at least one role with full access is the next step.

## Resume

```bash
cd /Users/hariprasadk/Documents/TutorialVid
WB_DIR=/tmp/tv-workblock-1777704233
FE=/Users/hariprasadk/Documents/buildxv2-frontend

# Discovery + scan + plan
node packages/cli/bin/tutorialvid discovery --cwd $WB_DIR --routes-from $FE --context-dir $FE/docs
node packages/cli/bin/tutorialvid scan --cwd $WB_DIR --routes-from $FE
node packages/cli/bin/tutorialvid plan --cwd $WB_DIR --select dashboard,backlog,login

# Skill loop runs script-prepare → dispatch tutorialvid-segment-author per work file → script-consume
# Then tts → record → compose → finalize
```

`tutorialvid.roles.json` already exists at `/tmp/tv-workblock-1777704233/tutorialvid.roles.json` with `coordinator` + `team_member` storage_state entries. Storage state files at `.tutorialvid/storage-state-{coordinator,team_member}.json` — both will need re-capture (Keycloak tokens 1 hr expiry).

## Files added / changed

```
A  packages/cli/src/commands/discovery.ts
A  packages/cli/src/discovery/{types,role-source,context,crawl,format,index}.ts
A  packages/plugin/agents/tutorialvid-segment-author.md
M  packages/cli/src/cache/paths.ts                 (discovery + per-role storage_state)
M  packages/cli/src/commands/{scan,plan,record,compose,finalize,script-prepare}.ts
M  packages/cli/src/compose/{index,format}.ts      (per-role assembly)
M  packages/cli/src/index.ts                       (CLI: discovery, --routes-from, --roles)
M  packages/cli/src/plan/{index,picker,types,format}.ts  (role expansion)
M  packages/cli/src/record/{index,inline-login}.ts (per-role storage_state lookup)
M  packages/cli/src/scan/index.ts                  (--routes-from)
M  packages/cli/src/scan/routes/react-router.ts    (JSX <Route path=/> support)
M  packages/cli/src/script/{prepare,consume,types,work-io,director}.ts
M  packages/cli/src/state/machine.ts               (discovery stage + Gate 0)
M  packages/plugin/skills/tutorialvid-create/SKILL.md
```
