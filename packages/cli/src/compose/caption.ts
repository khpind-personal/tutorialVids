import type { SrtWord } from "./srt.js";

export function activeWordAt(words: SrtWord[], t_ms: number): SrtWord | null {
  if (t_ms < (words[0]?.start_ms ?? 0)) return null;
  for (const w of words) {
    if (t_ms >= w.start_ms && t_ms < w.end_ms) return w;
  }
  return null;
}
