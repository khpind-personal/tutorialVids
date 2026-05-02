# Music templates

The 5 `.mp3` files in this directory are **silent placeholders** so the pipeline runs end-to-end out of the box. Replace them with real CC0 / royalty-free tracks before publishing.

## Recommended sources (CC0 / royalty-free)

- **Pixabay Music** — https://pixabay.com/music/ (CC0 / royalty-free)
- **Free Music Archive** — https://freemusicarchive.org/ (filter by CC0 / CC-BY)
- **Bensound** — https://www.bensound.com/ (royalty-free with attribution)
- **YouTube Audio Library** — https://studio.youtube.com/ (no attribution required)

## Tone matching

Each tone preset expects a backing track that fits its mood. Suggested directions:

| File | Tone | Suggested vibe |
|------|------|----------------|
| `friendly.mp3` | Friendly Guide | warm acoustic, gentle piano |
| `pro.mp3` | Pro/Concise | minimalist electronic, soft synth |
| `hype.mp3` | Hype/Launch | upbeat electronic, driving beat |
| `founder.mp3` | Founder POV | sincere indie, light strings |
| `documentary.mp3` | Documentary | calm ambient, slow piano |

Trim each track to roughly 3 minutes (the pipeline ducks to ~15% under TTS so it loops gracefully if shorter).

## Override per-project

A vibe coder can override the bundled music for their project by setting `compose.music_override_path` in `.tutorialvid/config.json`.
