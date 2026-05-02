import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { TTSChunk, WordTiming } from "./types.js";

export interface SynthesiseInput {
  chunk: TTSChunk;
  voice: string;
  speed: number;
  apiKeyEnv: string;
  model: string;
  language: string;
  outDir: string;
}

export interface SynthesiseResult {
  mp3_path: string;
  duration_ms: number;
  timing: WordTiming[];
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF = 800;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function evenWordTiming(text: string, durationMs: number): WordTiming[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const slice = durationMs / words.length;
  return words.map((w, i) => ({ word: w, start_ms: Math.round(i * slice), end_ms: Math.round((i + 1) * slice) }));
}

export async function synthesiseChunk(input: SynthesiseInput): Promise<SynthesiseResult> {
  const apiKey = process.env[input.apiKeyEnv];
  if (!apiKey) throw new Error(`${input.apiKeyEnv} is not set`);
  await mkdir(input.outDir, { recursive: true });
  const target = join(input.outDir, `${input.chunk.index}.mp3`);

  const client = new GoogleGenAI({ apiKey });
  let attempt = 0;
  while (true) {
    try {
      const resp = await client.models.generateContent({
        model: input.model,
        contents: [{ role: "user", parts: [{ text: input.chunk.ssml }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice } },
            speakingRate: input.speed,
            languageCode: input.language
          }
        }
      } as unknown as Parameters<typeof client.models.generateContent>[0]);

      const part = (resp as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> }).candidates?.[0]?.content?.parts?.[0];
      const data = part?.inlineData?.data;
      if (!data) throw new Error(`Gemini response had no audio data`);

      const audioBuf = Buffer.from(data, "base64");
      await writeFile(target, audioBuf);

      const { probeDurationMs } = await import("../ffprobe.js");
      const duration_ms = await probeDurationMs(target);
      const timing = evenWordTiming(input.chunk.text, duration_ms);

      return { mp3_path: target, duration_ms, timing };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && RETRYABLE.has(status) && attempt < DEFAULT_RETRIES) {
        await sleep(DEFAULT_BACKOFF * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
