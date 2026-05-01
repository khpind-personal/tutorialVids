# @tutorialvid/plugin

Claude Code plugin that orchestrates the TutorialVid pipeline.

## Installation

In Claude Code, install via the plugin's repository URL or marketplace listing.

## Requirements

- `@tutorialvid/cli` installed and on PATH
- `GEMINI_API_KEY` env var (required at the TTS stage)
- A vibe-coded web app with a reachable dev server

## v0.0.1 scope

- Slash command `/tutorialvid` triggers the skill
- Skill drives `tutorialvid scan` and summarizes the result
