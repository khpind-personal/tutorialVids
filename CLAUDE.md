# Project: TutorialVid — Claude Code guide

## What this project is

A Claude Code plugin (+ companion Node CLI) that turns a running vibe-coded web app into a polished tutorial video.

## Knowledge tiers (read in order)

1. **`docs/specs/`** — canonical design specs. Start with the most recent dated spec.
2. **`Vault/`** — durable curated knowledge:
   - `Vault/20-Decisions/` — locked product + technical decisions.
   - `Vault/30-Mistakes/` — corrections, gotchas. Always check before designing.
   - `Vault/50-Product/specs/` — spec mirrors.
   - `Vault/00-Index.md` — entry point.
3. **Existing plugin pattern** — `~/.claude/plugins/whiteboard-brainstorm/` is the closest reference layout when building skill structure.

## Vault write rules

- Mirror canonical specs from `docs/specs/` into `Vault/50-Product/specs/`. Never let the two drift.
- New decisions go into `Vault/20-Decisions/YYYY-MM-DD-<topic>.md` with frontmatter `status: active`.
- Corrections go into `Vault/30-Mistakes/`.
- Session logs in `Vault/10-Sessions/YYYY/MM/`.
- Do not edit notes with `status: superseded` or `status: archived`.

## Build conventions (when implementation starts)

- **Plugin** = thin orchestrator. Skills + slash commands + subagents only. No video processing in the skill.
- **CLI** = Node engine, all heavy lifting. Subcommands: `scan`, `plan`, `script`, `tts`, `record`, `compose`, `finalize`, `resume`, `redo`.
- **Cache** = content-hashed filesystem tree at `.tutorialvid/cache/`. Cascade invalidation. Per-segment surgical re-runs.
- **State** = `state.json` at the project root inside `.tutorialvid/`. Always resumable.
- **Communication** = JSON files + exit codes between skill and CLI. Never stdin/stdout coupling.
- **Subagents** are spawned per-segment in parallel for script + scene direction.

## Boundary contract

- Skill never touches mp4/audio bytes.
- CLI never asks the user a question — skill orchestrates all UX.
- Errors are formatted as `what happened, why, what to do next`.

## Out of scope (no commitment in v1)

Mobile responsive recording, native mobile, CLI-tool tutorials, multi-language narration, voice cloning, hosted SaaS service.

## Where things go

- Specs: `docs/specs/YYYY-MM-DD-<topic>.md` + mirror in `Vault/50-Product/specs/`.
- Decisions: `Vault/20-Decisions/`.
- Sessions: `Vault/10-Sessions/YYYY/MM/`.
- Plans: `docs/plans/YYYY-MM-DD-<topic>.md` (created when `superpowers:writing-plans` runs).
