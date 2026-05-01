# TutorialVid — Design Spec

**Date:** 2026-05-02
**Status:** draft (pending user review)
**Author:** Hariprasad K (with Claude)
**Phase:** Phase 1 (tutorial creation). Phase 2 (marketing distillation) deferred to a later spec.

---

## 1. Problem & Audience

A solo "vibe coder" (one developer who has just shipped a vibe-coded application) wants to publish a polished product tutorial video to help users walk through their tool, and later remix that material into a short marketing launch video.

Today, doing this means:
- Manually writing a script, recording screencasts, editing audio, and post-producing in DaVinci/Premiere/CapCut.
- Skill ceiling is high: cursor visibility, zoom focus, callouts, captions, voiceover, music, branding all require separate tools.
- Iteration is slow: one bad take = re-record + re-edit.

**Goal:** A Claude Code plugin that takes a vibe coder's running web app, understands it deeply (codebase + routes + runtime), and produces a tutorial video — with optional re-cut into a marketing video — in minutes, not days.

Success criteria for v1:
- A vibe coder with a working web app + a Gemini API key can go from `/tutorialvid` → finished `final.mp4` with no manual editing.
- The video has visible cursor, zoom emphasis on key clicks, captions, branded intro/outro, license-free music.
- Re-running with a small edit (e.g., one segment's narration) re-renders only what changed (cache hits everywhere else).
- Total wall time on a 5-page app, Medium depth, Friendly tone: under 15 minutes including TTS + render.

## 2. Scope

**In v1 (Phase 1):**
- Web apps only.
- Playwright-driven recording with auth waterfall (credentials → storage state → inline-shown login).
- 3 depths (Low / Medium / High) and 5 tone presets (Friendly Guide, Pro/Concise, Hype/Launch, Founder POV, Documentary).
- English-only narration via Gemini TTS.
- Hybrid scene direction (rule-based defaults + LLM overrides scaled by depth).
- 1080p30 default output, 16:9 aspect, captions burned-in + sidecar SRT.
- User-supplied logo/brand color; fallback templates for intro/outro.
- 5 license-free background music tracks, one per tone, with user-override.
- 4 user-review gates: Plan, Script, Recording (opt-in), Final draft preview.
- Content-hashed cache + resumable state; per-segment surgical re-runs.
- Per-tone cursor styles, click ripple, idle hide.
- Watermark on draft preview.

**Deferred to Phase 2 (separate spec):**
- Marketing video distillation: take Phase 1 outputs and re-cut into 15s/30s/60s/90s short-form video with hook + highlights + CTA.

**Out of scope (no commitment):**
- Mobile responsive recording, native mobile, CLI-tool tutorials.
- Multi-language narration.
- Voice cloning, AI-generated avatars.
- Live screen-share or hosted SaaS service.
- Analytics dashboard.

## 3. Architecture Overview

Two artifacts ship as one product:

```
@<your-org>/tutorialvid-plugin/      — Claude Code plugin (thin orchestrator)
  .claude-plugin/plugin.json
  skills/
    tutorialvid-create/SKILL.md       — Phase 1 entry
    tutorialvid-marketing/SKILL.md    — Phase 2 (deferred)
  commands/
    tutorialvid.md                    — /tutorialvid slash entry
  agents/
    tutorialvid-script-writer.md      — per-segment script subagent
    tutorialvid-scene-director.md     — per-segment scene.json subagent
  README.md

@<your-org>/tutorialvid-cli/         — Node CLI engine
  bin/tutorialvid
  src/
    scan/      — code-graph + routes + Playwright crawl reconciler
    plan/      — module picker, depth/tone application
    script/    — script + SSML emitter
    tts/       — Gemini TTS adapter (cache-aware)
    record/    — Playwright runner + cursor track emitter
    compose/   — Remotion compositor + ffmpeg muxer
    marketing/ — Phase 2 distiller (stub in v1)
    cache/     — content-hashed artifact store
    state/     — pipeline state machine + resume
  templates/
    intro/     — Remotion intro templates per tone
    music/     — 5 license-free tracks
    cursor/    — per-tone cursor SVGs
  package.json
```

**Boundary contract:**
- Skill = UX layer. Asks user, presents gates, displays plan/script/draft.
- CLI = engine. Long-running, debuggable, resumable. Never asks the user a question — skill orchestrates all UX.
- Communication = JSON files in `.tutorialvid/cache/` plus exit codes.
- Subagents = parallel script and scene-director generation per segment.

**Why this split:**
- Long renders need a real Node process, not a skill subprocess.
- The CLI is debuggable standalone (vibe coder can run `tutorialvid record-segment 3` without Claude).
- Resume semantics are critical — render fails halfway, restart from checkpoint.
- The skill stays thin = orchestrator + UX, not engine.

## 4. Components

### 4.1 `scan/` — Tool understanding

Reconciles three sources into one `ScanResult`:

1. **Code-graph reader** — calls `code-review-graph` MCP via local stdio bridge. Falls back to `graphify` CLI if MCP unavailable. Pulls nodes, communities, hubs, flows.
2. **Routes reader** — pluggable parsers per framework: React Router (`createBrowserRouter`, `<Route>`), Next.js app dir (`app/**/page.tsx`), Vite + file router, TanStack Router, Astro pages. Framework detected from `package.json`.
3. **Playwright crawler** — BFS from base URL with auth state loaded. Captures actually-mounted routes, page titles, primary CTAs above the fold, forms, modals.
4. **Reconciler** — joins all three. Flags discrepancies (route in code but never mounts; page mounts but not in router config; etc.).

Output: `cache/scan/<hash>.json` containing `pages[]`, `flows[]`, `personas[]`, `warnings[]`. Each page has `id`, `route`, `title`, `graph_node`, `primary_actions[]`, `requires_auth`, `needs_seed`, `importance` (hub-score, drives default selection).

### 4.2 `plan/` — User-driven plan

Skill shows a checklist (pages × selectable, sorted by `importance` desc), default-selects top-N. User toggles, picks depth (L/M/H), tone (A–E), aspect (16:9 default), branding info.

Emits `Plan` = ordered list of `Segment`. Each segment carries depth, target duration, tone, aspect, callout budget. Output: `cache/plan/<hash>.json`.

### 4.3 `script/` — Script + SSML

Per segment, dispatches `tutorialvid-script-writer` subagent with: page graph context, crawled DOM, depth, tone, word budget. Subagent returns narration text + SSML hints + per-action `narration_offset_ms` (audio-to-click alignment).

Then `tutorialvid-scene-director` subagent runs per segment with script + action list → emits `scene.json` (zoom, callouts, ripples per Q10 hybrid model: rules give baseline, LLM overrides scaled by depth).

Parallelism: N segments → N subagents in parallel.

Output: `cache/script/<segment_id>/<hash>.{txt,ssml,scene.json}`.

### 4.4 `tts/` — Gemini adapter

Reads SSML, calls Gemini TTS API with voice mapped per tone:

| Tone | Voice (placeholder) | Speed | Style |
|------|---------------------|-------|-------|
| A Friendly Guide | warm-female | 1.00x | conversational |
| B Pro/Concise | neutral-male | 1.05x | clear |
| C Hype/Launch | energetic-male | 1.10x | excited |
| D Founder POV | natural-male | 1.00x | sincere |
| E Documentary | calm-male | 0.95x | narrator |

Splits long narration into chunks at SSML pause points; caches per chunk so script edits only re-synth changed lines. Returns mp3 + per-word timing JSON for caption sync.

Output: `cache/script/<segment_id>/<hash>.mp3` + `<hash>.timing.json`.

### 4.5 `record/` — Playwright + cursor track

Runs auth waterfall **A → B → C**:
- **A. Credentials** (recommended): user provides login URL + selectors + creds via env vars. Plugin logs in via UI. Cheapest in time + tokens.
- **B. Storage state** (extra tokens): user manually logs in once, exports `storageState.json`, plugin loads it.
- **C. Inline auth in tutorial** (extra tokens): LLM reads login form code, generates login as Phase 0 of the tutorial. Used when user wants login shown on screen.

Skill shows token-cost warning when B or C is selected.

Runs seed script if config'd. Per segment:
- Reads `scene.json` action list.
- Drives Playwright deterministically (`nav`, `click`, `type`, `wait`, `assert`).
- Concurrently captures: video (Playwright `recordVideo`), cursor track (`page.on('mousemove')` + 60Hz polling, fallback to interpolation), DOM snapshots at key moments.
- Retry: 3x with backoff. On final fail, save screenshot + DOM, prompt skill which prompts user (replace selector / skip segment / abort).
- Detects auth expiry (401 / redirect to login) → re-runs auth → resumes current segment.

Output: `cache/record/<segment_id>/<hash>.{mp4, cursor.json, dom-snapshots.json}`.

### 4.6 `compose/` — Remotion + ffmpeg

Per segment, Remotion project generated from `scene.json`:
- Layer 1: raw Playwright clip (sourced from cache).
- Layer 2: cursor overlay rendered from cursor track + tone-specific SVG + click ripple animation. Idle hide ≥ 2s no movement.
- Layer 3: zoom/pan transforms per scene directives (CSS `transform: scale()` with spring easing).
- Layer 4: callouts (text bubbles, arrows).
- Layer 5: TTS audio aligned via timing JSON.
- Layer 6: captions burned-in from timing JSON + sidecar SRT exported.

Renders segment mp4 via `npx remotion render`. Stitcher: ffmpeg concat all segments + intro + outro + duck-mixed background music. Watermark applied on draft (Gate 4) only.

Output: `cache/compose/<segment_id>/<hash>.mp4`, then `cache/final/<hash>.mp4`.

### 4.7 `marketing/` — Phase 2 (deferred)

Stub interface defined now so Phase 1 emits compatible artifacts. Phase 2 will:
- Read `scene.json` for `highlight_score`, raw clips, separate audio tracks.
- LLM picks hook + 3–5 highlights per user's target length + platform aspect.
- Re-compose with new pacing + CTA card.

Phase 1 commitments to enable Phase 2:
- `scene.json` includes `highlight_score` per action (LLM-rated 0–10).
- Raw clips kept post-compose (not deleted).
- Audio kept as separate track files (not flattened).
- Recording uses 1920×1080 viewport with main UI in center safe-zone where reasonable, so 9:16 reframe is feasible.

### 4.8 `cache/` + `state/`

- Cache: content-hashed tree (Section 6).
- State: `state.json` records last completed gate, last error, last command, per-segment status. `tutorialvid resume` reads it and continues from the last good gate.

## 5. Data Flow

```
[user] /tutorialvid in Claude Code
  │
  ▼ skill reads CLAUDE.md + .tutorialvid/config.json
  │
  ├─ "Scan project?" → CLI: tutorialvid scan
  │     ├ code-review-graph MCP query
  │     ├ route parser (framework-detected)
  │     └ Playwright crawl (auth from config)
  │     → cache/scan/<h>.json
  │
  ├─ skill shows page list + importance score
  │  user toggles modules + picks depth + tone + branding
  │  → CLI: tutorialvid plan → cache/plan/<h>.json
  │
  ├─ GATE 1 (Plan) ← user approves or edits
  │
  ├─ CLI: tutorialvid script
  │  ├ N script-writer subagents (parallel)
  │  ├ N scene-director subagents (parallel)
  │  → cache/script/*/<h>.{txt,ssml,scene.json}
  │
  ├─ GATE 2 (Script) ← approve / per-segment edit
  │
  ├─ CLI: tutorialvid tts
  │  → cache/script/*/<h>.{mp3,timing.json}
  │
  ├─ CLI: tutorialvid record [--segment N]
  │  ├ auth waterfall A→B→C
  │  ├ seed script if configured
  │  ├ Playwright run from scene.json
  │  → cache/record/*/<h>.{mp4,cursor.json}
  │
  ├─ GATE 3 (Recording, opt-in) ← redo flagged segments
  │
  ├─ CLI: tutorialvid compose
  │  ├ Remotion render per segment (parallel workers)
  │  ├ ffmpeg stitch + intro/outro + music + watermark
  │  → cache/final/<h>-draft.mp4 (480p, watermarked)
  │
  ├─ GATE 4 (Final draft) ← approve / flag scenes for fix
  │
  └─ CLI: tutorialvid finalize
     → cache/final/<h>.mp4 (full HD, no watermark)
       + final.srt
       + per-segment mp4s + scripts (kept for Phase 2)
```

Resume points = every gate. Cache hits skip work.

## 6. Cache & Idempotency

Content-hashed artifact tree:

```
.tutorialvid/
  config.json                    — user-checked-in (no secrets)
  storage-state.json             — gitignored (auth artifact, optional)
  cache/
    scan/<hash>.json
    plan/<hash>.json
    script/<segment_id>/<hash>.{txt,ssml,scene.json,mp3,timing.json}
    record/<segment_id>/<hash>.{mp4,cursor.json,dom-snapshots.json}
    compose/<segment_id>/<hash>.mp4
    final/<hash>.mp4
  state.json
```

Hash inputs (so cache invalidates correctly):
- `scan` = `{git_sha, route_files_mtime, package_lock_sha}`.
- `plan` = `{scan_hash, modules_picked, depth, tone}`.
- `script` = `{plan_hash, segment_id, tone, language}`.
- `tts` = `{script_hash, voice_id, speed}`.
- `record` = `{plan_hash, segment_id, app_url, auth_state_hash, seed_hash}`.
- `compose` = `{record_hash, script_hash, branding_hash, music_hash}`.
- `final` = `{all segment compose_hashes, intro_hash, outro_hash}`.

Behavior:
- Re-run with same inputs → instant (all cache hits).
- User edits one segment's script → invalidates that segment's `script` + `tts` + `compose` + `final`. Other segments untouched.
- App code changes (new `git_sha`) → `scan` invalidates → cascade.
- `tutorialvid redo --segment 3 [--stage record]` = nuke from stage onward, force rebuild, reuse rest.

`.tutorialvid/cache/` is gitignored. `.tutorialvid/config.json` is checked in (no secrets — secrets via env).

## 7. Key Schemas

### 7.1 `config.json`

```json
{
  "version": 1,
  "app": {
    "name": "MyTool",
    "dev_url": "http://localhost:5173",
    "start_server": false,
    "framework_hint": "vite-router"
  },
  "auth": {
    "mode": "waterfall",
    "credentials": {
      "username_env": "TV_USER",
      "password_env": "TV_PASS",
      "username_selector": "[name=email]",
      "password_selector": "[name=password]",
      "submit_selector": "button[type=submit]",
      "login_url": "/login"
    },
    "storage_state_path": ".tutorialvid/storage-state.json",
    "show_login_in_tutorial": false
  },
  "seed": {
    "command": "npm run db:seed:demo",
    "skip_if_exists": ".tutorialvid/.seeded"
  },
  "branding": {
    "logo_path": "./assets/logo.svg",
    "primary_color": "#7C3AED",
    "intro_template": "minimal",
    "outro_template": "cta-link",
    "outro_cta": "Try it free at example.com"
  },
  "render": {
    "resolution": "1920x1080",
    "fps": 30,
    "max_total_duration_s": 900,
    "max_segment_duration_s": 240
  },
  "tts": {
    "provider": "gemini",
    "api_key_env": "GEMINI_API_KEY",
    "language": "en-US"
  },
  "telemetry": { "enabled": false }
}
```

### 7.2 `scene.json` (per segment)

```json
{
  "segment_id": "s03_create_project",
  "page_id": "/projects/new",
  "depth": "medium",
  "tone": "founder",
  "target_duration_s": 75,
  "actions": [
    { "t_ms": 0, "type": "nav", "url": "/projects/new" },
    { "t_ms": 1200, "type": "wait", "selector": "[data-test=name-input]" },
    {
      "t_ms": 1500, "type": "type",
      "selector": "[data-test=name-input]",
      "text": "Acme Launch",
      "zoom": { "scale": 1.6, "in_ms": 300, "hold_ms": 1800, "out_ms": 300 }
    },
    {
      "t_ms": 4500, "type": "click",
      "selector": "[data-test=create-btn]",
      "zoom": { "scale": 2.0, "in_ms": 400, "hold_ms": 800, "out_ms": 400 },
      "ripple": true,
      "callout": { "text": "Saves a draft you can edit later", "anchor": "right", "duration_ms": 1800 },
      "highlight_score": 8
    }
  ],
  "narration": {
    "text": "Let's create a new project. I'll give it a name, then click create.",
    "ssml": "<speak>Let's create a new project. <break time='200ms'/> I'll give it a name, then click create.</speak>",
    "alignments": [
      { "phrase": "create a new project", "action_t_ms": 0 },
      { "phrase": "give it a name", "action_t_ms": 1500 },
      { "phrase": "click create", "action_t_ms": 4500 }
    ]
  }
}
```

### 7.3 `state.json`

```json
{
  "last_completed_stage": "tts",
  "last_command": "tutorialvid tts",
  "started_at": "2026-05-02T10:00:00Z",
  "segments": {
    "s01": { "scan": "ok", "plan": "ok", "script": "ok", "tts": "ok",
             "record": "pending", "compose": "pending" },
    "s02": { "scan": "ok", "plan": "ok", "script": "ok", "tts": "ok",
             "record": "failed", "last_error": "selector .x timed out" }
  },
  "gates_passed": ["plan", "script"]
}
```

## 8. User-Review Gates

| # | Gate | What user sees | Default | Cost if reject |
|---|------|----------------|---------|---------------|
| 1 | Plan | Markdown table: pages × actions × depth × tone | ON | LLM only (cheap) |
| 2 | Script | Final TTS-ready script per segment, side-by-side with action list | ON | LLM only (cheap) |
| 3 | Recording | Raw Playwright clips per segment, no audio, no overlays — user marks "redo" | OFF (opt-in for High depth) | Re-record one segment (medium) |
| 4 | Final preview | Low-res draft mp4 (480p, watermarked) | ON | Re-render flagged scenes (medium) |

Per-segment surgical re-run: `tutorialvid redo --segment 3 --reason "too fast"` regenerates one segment + reuses everything else from cache.

## 9. Depth × Tone × Render Knobs

| Depth | Script density | Visual treatment | Length per module |
|-------|----------------|------------------|-------------------|
| Low | "what + where" — name feature, click, show result | No zoom, no annotations, fast cuts | 20–40s |
| Medium | "what + where + why" — adds 1-line rationale, 1 callout per page | Zoom into target before click, soft highlight | 60–90s |
| High | "what + where + why + edge cases + tips" — explains options, alt paths, gotchas | Zoom + arrow overlays + slow-mo on key clicks + "pro tip" callouts | 2–4 min |

Per-tone cursor styles, SVGs in `templates/cursor/<tone>.svg`. Per-tone music tracks in `templates/music/<tone>.mp3`.

## 10. Error Handling

| Failure | Handler |
|---------|---------|
| Dev server not reachable | probe ports → if `start_server: true`, run script and wait for ready signal → else exit with clear message |
| Auth fails | A→B→C waterfall, each failure prompts skill to ask user for next-tier input |
| Selector flaky | retry 3x backoff → on final fail, save screenshot + DOM, prompt skill which prompts user: replace selector / skip segment / abort |
| Auth expires mid-record | detect 401 / redirect-to-login → re-run auth → resume current segment from last action |
| Gemini TTS API down | exponential backoff, `state.json` records progress, `tutorialvid resume` continues |
| Remotion render crash | per-segment isolation — one bad segment doesn't kill the batch; log + flag for redo |
| ffmpeg mux fail | inspect codecs, log command, abort with command shown so user can reproduce |
| Cache corruption | hash mismatch detected on read → invalidate that artifact + cascade |

User never sees raw stack traces. Skill formats errors as `what happened, why, what to do next`.

## 11. Testing Strategy

- **Unit tests (CLI):** pure functions in `scan/reconciler`, `plan/picker`, `script/budgeter`, `compose/timeline-builder`, `cache/hasher`. Vitest.
- **Integration tests (CLI):** each subcommand against fixture vibe-coded app (`fixtures/sample-app/` — minimal Vite + React Router + 3 pages + auth). Asserts cache hits, gate outputs, error messages.
- **E2E test (CLI):** full `scan → finalize` against `fixtures/sample-app` — verifies `final.mp4` exists, has correct duration band, captions present, audio non-silent.
- **Skill tests:** skill decision logic tested via mocked CLI responses. Skill does not run real CLI in tests.
- **Visual regression (compose):** one canonical scene rendered → frame compared to golden PNG (tolerance 1% per pixel).
- **Manual checklist:** `docs/manual-test-checklist.md` for vibe-coder UX flow.

## 12. Distribution & Naming

- Plugin name (placeholder): **TutorialVid**. Final name TBD by user.
- Repos: GitHub-first. Plugin = `@<org>/tutorialvid-plugin`. CLI = `@<org>/tutorialvid-cli` on npm.
- License: MIT (default; user may override).
- API key: user provides own Gemini API key via env. No bundled key.
- Plugin marketplace: optional; ship via repo URL first, marketplace later.

## 13. Phase 1 vs Phase 2 Split

**Phase 1 (this spec):** scan, plan, script, tts, record, compose, finalize, cache, state, all 4 gates, 5 tones, 3 depths, web-only, 1080p30, captions, branding, music, watermark, error handling, resume.

**Phase 2 (later spec, after Phase 1 ships):** marketing video distillation. Phase 1 outputs commitments above ensure compatibility.

**Out of scope (no commitment):** mobile responsive recording, native mobile, CLI-tool tutorials, multi-language narration, voice cloning, AI-generated avatars, live screen-share, hosted SaaS service, analytics dashboard.

## 14. Open Questions / Risks

- **Gemini TTS voice catalog** — exact voice IDs per tone TBD at impl. Placeholder mapping in §4.4.
- **Selector reliability across vibe-coded apps** — many vibe-coded apps lack `data-test` attrs. May need fallback to ARIA/role-based selectors. Plugin can suggest a `data-test` codemod as a separate skill later.
- **Render-time bottleneck** — Remotion per-frame puppeteer render is slow for 1080p60. Holding default at 1080p30 mitigates; parallel segment rendering recovers more.
- **Audio-action sync** — depends on `narration_offset_ms` from script subagent being accurate. May need a calibration pass that listens to actual TTS output and re-aligns. Decision deferred to plan.
- **Cost transparency** — TTS + LLM tokens add up. Plugin should print estimated $ before each gate.

## 15. Decisions Locked During Brainstorm

| # | Decision |
|---|----------|
| 1 | Web-only v1, mobile responsive deferred |
| 2 | Hybrid scan: code-graph + routes + crawl reconciled |
| 3 | Auth waterfall A→B→C; A recommended; explicit token warning on B/C |
| 4 | Depth Low/Medium/High per §9 table |
| 5 | Seed step optional, warn on empty app |
| 6 | 5 tone presets A–E shipped in v1; English only; Gemini TTS |
| 7 | Composer = Playwright + Remotion hybrid |
| 8 | Cursor = track-based Remotion overlay; ripple yes; idle hide yes; per-tone style yes |
| 9 | Plugin runtime = thin Claude skill + Node CLI engine |
| 10 | 4 gates (Plan ON, Script ON, Recording opt-in, Final draft ON); per-segment redo |
| 11 | Scene direction = hybrid rules + LLM overrides scaled by depth |
| 12 | Cache = content-hashed filesystem tree; cascade invalidation; resume |
| 13 | 1080p30 default, 15min total cap, 4min segment cap, captions burned + SRT, user-supplied branding with templates |
| 14 | Music = 5 license-free per-tone tracks + override; watermark on drafts |
| 15 | Dev server: probe + opt-in start; selector retry 3x; auth re-recovery; telemetry off-by-default |
| 16 | Phase 2 marketing distillation = separate spec; Phase 1 emits compatible artifacts |
