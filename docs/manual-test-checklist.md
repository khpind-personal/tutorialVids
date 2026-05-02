# TutorialVid — Manual test checklist

## Plan 1 acceptance: foundation + scan

- [ ] `tutorialvid --version` prints `0.0.1`.
- [ ] `tutorialvid --help` lists a `scan` command.
- [ ] In a project with `react-router-dom` and a dev server on port 5173, running `tutorialvid scan` produces `.tutorialvid/cache/scan/<hash>.json` with `framework: "react-router"`.
- [ ] Re-running `tutorialvid scan` with no code changes logs `cache hit` and does not rewrite the file.
- [ ] Modifying a route file then re-running `tutorialvid scan` produces a new hash and a new file.
- [ ] When `GEMINI_API_KEY` is unset, scan still succeeds (TTS not invoked at this stage).
- [ ] When credentials env vars are unset, scan logs a warning and crawls without auth.
- [ ] In Claude Code, `/tutorialvid` invokes the `tutorialvid-create` skill, which calls the CLI and reports framework + page count + top-5 pages by importance.

## Plan 2 acceptance: plan + script + Gates 1, 2

Prereq: `ANTHROPIC_API_KEY` set, scan already produced.

- [ ] `tutorialvid plan --cwd <project>` reads the latest scan and produces `.tutorialvid/cache/plan/<hash>.json`.
- [ ] `tutorialvid plan --top-n 3` selects top 3 pages by importance.
- [ ] `tutorialvid plan --select id1,id2` overrides defaults.
- [ ] Markdown output of `plan` matches the table in spec §8 Gate 1.
- [ ] Re-running `tutorialvid plan` with same inputs hits cache (no rewrite).
- [ ] `tutorialvid script --cwd <project>` dispatches subagents and writes `cache/script/<segment>/<hash>.{scene.json,txt,ssml}` per segment.
- [ ] Subagent prompts come from `packages/plugin/agents/*.md` and have valid frontmatter.
- [ ] With `ANTHROPIC_API_KEY` unset, `tutorialvid script` exits non-zero with a clear error referencing the env var name.
- [ ] Parallel fan-out is bounded by `config.anthropic.max_concurrency`.
- [ ] `state.json.last_completed_stage` advances `scan` → `plan` → `script` on each successful run.
- [ ] In Claude Code, `/tutorialvid` walks through scan → Gate 1 (plan) → Gate 2 (script) and pauses at each gate.

## Plan 3 acceptance: tts + record + Gate 3

Prereqs: `GEMINI_API_KEY` set, scan + plan + script already run, `TV_USER`/`TV_PASS` set, `localhost:5173` dev server up.

- [ ] `tutorialvid tts --cwd <root>` synthesises one mp3 per chunk under `cache/script/<segment>/`. Real audio plays back.
- [ ] Re-running `tutorialvid tts` with no script change is idempotent.
- [ ] `tutorialvid record --cwd <root>` produces an mp4 + cursor.json per segment under `cache/record/<segment>/`.
- [ ] Recording uses headless Chromium at 1920x1080 by default.
- [ ] Setting `record.headless: false` opens a visible browser.
- [ ] Selector retry kicks in when an `[data-test=...]` is briefly absent (mount delay).
- [ ] Setting `record.gate_3_enabled: true` prints the Gate 3 markdown for the user.
- [ ] Storage-state mode (B) loads cookies and skips the login flow.
- [ ] Auth-expiry recovery: artificially clear the session mid-run; recorder re-authenticates and resumes.
- [ ] Per-segment state advances `tts` then `record` to `ok`.

## Plan 4 acceptance: compose + Gate 4

Prereqs: Plans 1-3 manually verified, mp3 + cursor + raw mp4 artifacts present.

- [ ] `tutorialvid compose --cwd <root>` produces `cache/compose/<segment>/<hash>.mp4` per segment.
- [ ] `cache/final/draft.mp4` exists at 854x480 with `DRAFT — TutorialVid` watermark visible top-right.
- [ ] `cache/final/draft.srt` is a valid SRT file (open in any caption tool).
- [ ] Cursor SVG matches the segment's tone (e.g. friendly = purple).
- [ ] Zoom on click is visible during the 200/600/200 ms window.
- [ ] Callouts appear at the action's t_ms and disappear after duration_ms.
- [ ] Background music is audible at ~15% volume under TTS narration.
- [ ] Intro shows `app.name`; outro shows `compose.outro_cta`.
- [ ] Setting `compose.music_override_path` swaps the music track.
- [ ] Setting `compose.music_volume: 0` removes music entirely.
- [ ] Per-segment state advances `compose` to `ok`.

## Plan 5 acceptance: finalize + polish

- [ ] `tutorialvid finalize --cwd <root>` produces `cache/final/final.mp4` (full HD, no watermark) and `cache/final/final.srt`.
- [ ] Per-segment audio durations come from ffprobe (visible in TTS log output as accurate ms, not heuristic estimates).
- [ ] Cursor on click in the rendered video appears at the actual button centre (not 0,0).
- [ ] Setting `auth.show_login_in_tutorial: true` causes the recorder to insert an `s00_login` segment as the first scene, with the password masked as bullets in the typed text.
- [ ] Triggering an error (unset env, missing artifact, bad selector) prints the 3-line ✖/why/next surface — not a raw stack trace.
- [ ] Setting `telemetry.enabled: true` logs a structured `telemetry event` line per stage.
- [ ] Intro and outro look animated (fade in + scale on intro; fade in/out on outro) — not static drawtext frames.
- [ ] Plugin v1.0.0 SKILL.md walks through all 7 commands.

## Plan 6 acceptance: Claude Code subagent dispatch for script stage

- [ ] `tutorialvid script-prepare --cwd <root>` writes `cache/script/_work/<segment>.{writer,director}.json` files.
- [ ] Each work file contains `agent_name`, `system_prompt`, `user_payload`.
- [ ] Skill loop: dispatch writer Task subagents per segment → save outputs to `_result/<segment>.writer.json` → dispatch director subagents (consuming writer results) → save outputs to `_result/<segment>.director.json`.
- [ ] `tutorialvid script-consume --cwd <root>` validates each result, writes `cache/script/<segment>/<hash>.scene.json/txt/ssml`, prints Gate 2 markdown.
- [ ] Default `tutorialvid script` (no flag) inside Claude Code: works without `ANTHROPIC_API_KEY`.
- [ ] `tutorialvid script --standalone` falls back to Anthropic SDK and requires `ANTHROPIC_API_KEY`.
- [ ] Both modes produce identical scene.json structure for the same plan + same LLM model.
