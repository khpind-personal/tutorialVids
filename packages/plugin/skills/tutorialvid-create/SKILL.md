---
name: tutorialvid-create
description: Use when the user wants to create a tutorial video for their running web app. Drives the TutorialVid pipeline: discovery → scan → plan → script → tts → record → compose → finalize, with user-review gates between stages. Requires `@tutorialvid/cli` installed and a Gemini API key.
---

# tutorialvid-create

Walk the user through producing a tutorial video for their vibe-coded web app.

## Prerequisites

Before doing anything else, verify:

1. `tutorialvid` CLI is on PATH. Run `tutorialvid --version`. If missing, tell the user: `npm i -g @tutorialvid/cli`.
2. Project root contains `.tutorialvid/config.json`. If missing, generate one.
3. Project root (or `--roles-file`) contains `tutorialvid.roles.json` with one entry per role to cover (id, label, auth). At least one role is required.
4. `GEMINI_API_KEY` env var is set. Required for TTS.
5. `ANTHROPIC_API_KEY` is only needed for `tutorialvid script --standalone` (CI / headless). When run inside Claude Code, the skill dispatches Task subagents using the existing session auth.
6. Dev server is reachable at `config.app.dev_url`.

## Capability (v1.2.0+)

Pipeline supports eight commands forming the full Phase 1 flow: **discovery → scan → plan → script → tts → record → compose → finalize**, with Gates 0, 1, 2, 3 (opt-in), and 4.

### Flow

1. **Discovery — Gate 0**: `tutorialvid discovery --cwd <root> [--routes-from <src>] [--context-dir <path>] [--roles-file <path>]`
   - Loads `tutorialvid.roles.json` (roles + per-role auth).
   - Walks each route under each authenticated role using a separate Playwright session.
   - Emits `discovery.json` with: per-role accessibility matrix, per-(route × role) DOM hash + nav signature, common pages (identical DOM across roles), and an ingested markdown corpus from CLAUDE.md / README.md / docs/ / `--context-dir` paths.
   - Show user the role list + accessibility matrix; let them confirm/edit before proceeding.

2. **Scan**: `tutorialvid scan --cwd <root> [--routes-from <src>]` — list framework, pages, top-N by importance, warnings.

3. **Plan — Gate 1**: `tutorialvid plan --cwd <root> [--roles <ids>] [--select <page-ids>]`
   - Plan picker reads scan + discovery and emits one segment per **(page × role)** for role-specific pages, and a single segment with `role: "common"` for pages whose DOM is identical across roles.
   - Markdown table shows ID, route, title, role, auth, importance, duration. User approves/edits.
   - Pages a role cannot access are skipped automatically.

4. **Script — Gate 2**: skill-driven Task subagent dispatch (no `ANTHROPIC_API_KEY` required when running inside Claude Code).

   Loop:
   1. Run `tutorialvid script-prepare --cwd <root>`. CLI emits one `.tutorialvid/cache/script/_work/<segment_id>.author.json` per segment. Each work file embeds: the segment + page_actions + `role_view` (the role's unique elements + DOM hash from discovery) + the discovery `context_corpus` (project markdown distilled).
   2. For each work file, dispatch a Task subagent:
      - Read the work file's `agent_name` (always `tutorialvid-segment-author` in v1.2.0+).
      - Use `subagent_type: tutorialvid-segment-author` with the work file's `system_prompt` baked into the agent definition.
      - Pass the work file's `user_payload` as the prompt content.
      - Capture the subagent's JSON-only response and save to `.tutorialvid/cache/script/_result/<segment_id>.author.json`.
   3. Run `tutorialvid script-consume --cwd <root>`. CLI validates each result (must include both `narration` and `actions`), writes scene.json + txt + ssml, prints Gate 2 markdown.

   Why the merge: writer + director used to be two independent agents and could drift (narration described one element while scene zoomed on another). The single segment-author writes both at once and aligns by construction.

   For headless / standalone use (CI, no Claude Code session): `tutorialvid script --standalone --cwd <root>` still uses the legacy split (writer + director) via the Anthropic SDK and requires `ANTHROPIC_API_KEY`. The standalone path does not yet emit role-aware narration; prefer the skill-driven flow.

5. **TTS**: `tutorialvid tts --cwd <root>` — needs `GEMINI_API_KEY`. mp3 + per-word timing per segment (ffprobe-derived).

6. **Record — Gate 3 (opt-in)**: `tutorialvid record --cwd <root>` — Playwright video + cursor track + per-segment auth selection. Each segment uses the storage_state / credentials of its role from discovery; common segments fall back to the project default. Live bbox capture writes `<hash>.bboxes.json` alongside the webm so highlight + zoom anchor on real on-screen elements (no static bbox in scene.json).

7. **Compose — Gate 4**: `tutorialvid compose --cwd <root>` — Remotion per-segment compositions + ffmpeg stitch, **grouped by role**. Emits one watermarked draft per role at `cache/final/draft.<role>.mp4` (and `draft.<role>.srt`); common segments are concatenated into every role's draft. Single-role / common-only projects fall back to `cache/final/draft.mp4` for back-compat.

8. **Finalize**: `tutorialvid finalize --cwd <root>` — promotes each role's HD stitch to `cache/final/final.<role>.mp4` (no watermark). Single-role / common-only flows produce `cache/final/final.mp4`.

### Auth

Per-role auth blocks live in `tutorialvid.roles.json`. Two modes per role:

- `storage_state`: point at a Playwright `storage-state-<role>.json` (cookies + localStorage). Recommended.
- `credentials`: env-var-backed username/password + selectors. Falls back to `config.auth.credentials` selectors when not specified per role.

Use `mcp__plugin_playwright_playwright__*` tools to capture per-role storage_state files when needed (login as the role, dump localStorage + cookies).

### Errors

All command errors surface as a 3-line block: `✖ what / why: ... / next: ...`. No raw stack traces.

### Telemetry

Off by default. Set `telemetry.enabled: true` to log structured events per stage.

## Config bootstrap

If `.tutorialvid/config.json` is absent, gather these values interactively and write the file. Use `packages/cli/src/config/schema.ts` as the source of truth.

If `tutorialvid.roles.json` is absent, ask the user for the role list. Minimal example:

```json
{
  "roles": [
    {
      "id": "coordinator",
      "label": "Coordinator",
      "auth": {
        "mode": "storage_state",
        "storage_state_path": ".tutorialvid/storage-state-coordinator.json"
      }
    }
  ]
}
```

## What this skill must NOT do

- Manipulate mp4 or audio bytes directly outside the CLI.
- Hardcode API keys.
- Run any stage without its required env var or prior-stage artifacts — surface the formatted error instead.
- Enable `gate_3_enabled` by default — only opt-in for High-depth tutorials.
- Ship the watermarked draft as the final video — always run `tutorialvid finalize` for publication.
- Add static bbox values to scene.json highlights — the architecture is `selector → live bbox → paint`, and Playwright is the only source of pixel coords.
