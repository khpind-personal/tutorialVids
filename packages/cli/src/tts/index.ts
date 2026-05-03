import { chunkSsml } from "./chunker.js";
import { resolveVoice, type ToneVoiceMap, type ToneSpeedMap } from "./voices.js";
import { synthesiseChunk } from "./gemini.js";
import type { Tone, WordTiming } from "./types.js";
import type { SceneJson } from "../script/types.js";

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

export interface BeatTtsChunk {
  index: number;
  beat?: string;
  action_t_ms: number;
  phrase: string;
  mp3_path: string;
  duration_ms: number;
}

export interface RunTtsResult {
  chunks: { index: number; mp3_path: string; duration_ms: number; action_t_ms?: number; phrase?: string; beat?: string }[];
  duration_ms: number;
  timing: WordTiming[];
  mode: "beat" | "chunked";
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

  return { chunks: results, duration_ms: cursorMs, timing, mode: "chunked" };
}

export interface RunBeatTtsInput {
  scene: SceneJson;
  tone: Tone;
  voices: ToneVoiceMap;
  speeds: ToneSpeedMap;
  apiKeyEnv: string;
  model: string;
  language: string;
  outDir: string;
}

export async function runTtsBeats(input: RunBeatTtsInput): Promise<RunTtsResult> {
  const { voice, speed } = resolveVoice(input.tone, input.voices, input.speeds);
  const beats = input.scene.actions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => typeof a.narration_phrase === "string" && a.narration_phrase.trim().length > 0);

  const results: RunTtsResult["chunks"] = [];
  const timing: WordTiming[] = [];
  let totalEndMs = 0;

  for (let i = 0; i < beats.length; i++) {
    const { a } = beats[i]!;
    const phrase = a.narration_phrase!.trim();
    const r = await synthesiseChunk({
      chunk: { index: i, ssml: `<speak>${phrase}</speak>`, text: phrase },
      voice, speed,
      apiKeyEnv: input.apiKeyEnv, model: input.model, language: input.language,
      outDir: input.outDir
    });
    for (const t of r.timing) {
      timing.push({ word: t.word, start_ms: a.t_ms + t.start_ms, end_ms: a.t_ms + t.end_ms });
    }
    results.push({
      index: i,
      mp3_path: r.mp3_path,
      duration_ms: r.duration_ms,
      action_t_ms: a.t_ms,
      phrase,
      ...(a.beat ? { beat: a.beat } : {})
    });
    totalEndMs = Math.max(totalEndMs, a.t_ms + r.duration_ms);
  }

  return { chunks: results, duration_ms: totalEndMs, timing, mode: "beat" };
}
