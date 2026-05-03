---
title: Tutorial visual style — context-preserving wide views, single-zoom CTA
date: 2026-05-03
status: locked
tags: [tutorial, scene-direction, visual-style, decision]
---

## Decision

Tutorial scenes follow a **context-preserving wide-view** style with a single zoom moment per segment reserved for the key CTA (when one exists). All other beats hold the camera at zoom 1.0 over the full viewport and use a screen-space spotlight + glow to draw the eye.

## Rules

1. **Zoom 1.0 by default.** Most beats do not zoom.
2. **One zoom per segment, max.** Cap at 1.4–1.7 scale, only on a beat where the narration calls out a single small element the user will press.
3. **`wait` not `click`.** Pure dashboard/overview tours use `wait` actions; `click` is reserved for actual flow demonstrations (form submits, modal opens).
4. **Establish-wide first beat.** Right after `nav`, hold zoom 1.0 with no highlight for 2–4 s. Beat name `1-establish-wide`.
5. **Pull-back-wide penultimate beat.** Before the final tail, hold zoom 1.0 with no highlight for 3–5 s. Beat name `<n>-pull-back-wide`.
6. **Long teaching holds.** 5–12 s per beat. Two-second jumps feel anxious.
7. **Parent-traversal selectors for spotlight anchors.** Card-level containers, never inner text nodes. xpath `ancestor::div[3]` or class-scoped ancestors.
8. **Spotlight + glow over zoom.** `highlight: { style: "spotlight"|"both", intensity: 0.45–0.6, pad: 4–8, radius: 8–18, pulse: true|false }` is the primary attention mechanism.
9. **Corner anchor callouts.** `top-right` / `bottom-left` etc. with `max_width` 240–360 px. Callout text ≤ 6 words.
10. **Beat names mandatory.** Every action gets `beat: "<n>-<short-kebab-name>"` for self-documentation.

## Why

- Iters 1–7 against WorkBlock used zoom-heavy direction. Cropped letters, jumpy pacing, viewer lost orientation. Iter 8 manually pulled to wide views; iter 9 codified the manual refinement and looked clean.
- The merged `tutorialvid-segment-author` agent regenerated the iter-1–7 pattern in iter 10 because the original prompt defaulted to `click → zoom 1.8`. Lesson: defaults in the agent prompt are not just suggestions — they're the floor of quality.
- Context preservation matters most for *teaching* segments (dashboard tours, layout walkthroughs) which dominate Phase 1 output. Action segments (form fill, button click) get the single zoom moment.

## Where encoded

- `packages/plugin/agents/tutorialvid-segment-author.md` — "Context preservation", "Selector rules", "Scene rules", "Callout rules", "Hard rules" sections.
- `Vault/30-Mistakes/2026-05-03-zoom-heavy-tight-crop.md` — regression detection + diagnosis.
- `~/.claude/projects/-Users-hariprasadk-Documents-TutorialVid/memory/feedback_tutorial-visual-style.md` — auto-memory pointer.

## Reference (canonical good scene)

`output/workblock-2026-05-02/scenes/s01_dashboard.scene.json` — manually-refined iter-9 scene, 8 beats, 1 zoom (Pick Up button at 1.7×), 7 wide-view holds with spotlight + glow, parent-traversal selectors throughout.

## Tags

#decision #locked #segment-author #scene-direction #visual-style
