import { chunkSsml } from "./chunker.js";
import { resolveVoice, type ToneVoiceMap, type ToneSpeedMap } from "./voices.js";
import { synthesiseChunk } from "./gemini.js";
import type { Tone, WordTiming } from "./types.js";

export interface RunTtsInput {
  ssml: string;
  tone: Tone;
  voices: ToneVoiceMap;
  speeds: ToneSpeedMap;
  apiKeyEnv: string;
  model: string;
  language: string;
  chunkMaxChars: number;
  outDir: string;
}

export interface RunTtsResult {
  chunks: { index: number; mp3_path: string; duration_ms: number }[];
  duration_ms: number;
  timing: WordTiming[];
}

export async function runTts(input: RunTtsInput): Promise<RunTtsResult> {
  const { voice, speed } = resolveVoice(input.tone, input.voices, input.speeds);
  const chunks = chunkSsml(input.ssml, input.chunkMaxChars);

  const results: RunTtsResult["chunks"] = [];
  let cursorMs = 0;
  const timing: WordTiming[] = [];
  for (const chunk of chunks) {
    const r = await synthesiseChunk({
      chunk, voice, speed,
      apiKeyEnv: input.apiKeyEnv, model: input.model, language: input.language,
      outDir: input.outDir
    });
    for (const t of r.timing) {
      timing.push({ word: t.word, start_ms: cursorMs + t.start_ms, end_ms: cursorMs + t.end_ms });
    }
    results.push({ index: chunk.index, mp3_path: r.mp3_path, duration_ms: r.duration_ms });
    cursorMs += r.duration_ms;
  }

  return { chunks: results, duration_ms: cursorMs, timing };
}
