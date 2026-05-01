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
