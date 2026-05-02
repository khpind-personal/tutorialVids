import type { Tone, VoiceMapping } from "./types.js";

export type ToneVoiceMap = Record<Tone, string>;
export type ToneSpeedMap = Record<Tone, number>;

export function resolveVoice(tone: Tone, voices: ToneVoiceMap, speeds: ToneSpeedMap): VoiceMapping {
  return { voice: voices[tone], speed: speeds[tone] };
}
