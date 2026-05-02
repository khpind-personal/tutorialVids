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
