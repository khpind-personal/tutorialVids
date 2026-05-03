---
title: Zoom-heavy tight-crop visual style — recurring failure
date: 2026-05-03
status: active
tags: [tutorial, scene-direction, visual-style, segment-author]
---

## Symptom

Generated scenes default to `zoom: { scale: 1.8, in_ms: 400, hold_ms: 800, out_ms: 400 }` on every beat with `text=Coordinator Queue`-style selectors. The result is pixel-tight zooms cropping into a few letters of one element ("dinator [cursor] eue"), losing all surrounding nav/page context, with 2-3 second jumpy holds and no time to read the highlight.

This is the iter-10 regression that triggered this note. Earlier observation IDs (memory) 4798, 4799, 4801–4807, 4811–4817 logged the exact same fight against this pattern in iters 1–7 of WorkBlock recording.

## Why it keeps coming back

- LLM defaults to "zoom = visual emphasis" because that's what the original `tutorialvid-scene-director` prompt encoded (`click → zoom 1.8x for 400/800/400 ms`). The merged segment-author inherited the same defaults.
- "Click → zoom 1.8" is intuitive but wrong for **dashboard / overview** segments where the goal is teaching layout, not demonstrating an interaction.
- Naive `text=X` selectors resolve to the inner text node, so the live bbox is the size of the glyphs — when the camera then zooms 1.8× on that, you crop into one element with no surrounding context.

## Locked fix

The scene direction style is locked to **"context-preserving wide views, single-zoom CTA, parent-traversal card selectors"** — see `Vault/20-Decisions/2026-05-03-tutorial-visual-style.md`.

In code: `packages/plugin/agents/tutorialvid-segment-author.md` "Context preservation" + "Selector rules" + "Scene rules" sections encode the rules. Defaults moved from `click → zoom 1.8` to `wait → zoom 1.0 + spotlight`.

## How to detect a regression

Open the generated `<segment>.scene.json`. Run:

```bash
jq -c '.actions[] | select(.zoom != null) | {t_ms, type, scale: .zoom.scale, hold: .zoom.hold_ms}' scene.json
```

Healthy output (medium depth segment):
- 6–8 actions
- `scale: 1.0` on every beat *except* at most ONE
- The one zoom beat has `scale: 1.4–1.7` and `hold_ms ≥ 5000`
- `hold_ms` 5000–12000 on teaching beats
- First non-nav beat has `beat: "1-establish-wide"` with no highlight
- Penultimate beat has `beat: "<n>-pull-back-wide"` with no highlight

Unhealthy output (the regression):
- Every beat has `zoom.scale = 1.8`
- Hold times 800–3500 ms
- All selectors `text=X` form (no parent-traversal)
- No `establish-wide` or `pull-back-wide` beats
- Cursor + tight outline cropping into glyphs

## Tags

#segment-author #scene-direction #visual-style #regression-prevention
