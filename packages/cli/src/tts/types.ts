export interface TTSChunk {
  index: number;
  ssml: string;
  text: string;
}

export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TTSResult {
  mp3_path: string;
  timing: WordTiming[];
  duration_ms: number;
}

export type Tone = "friendly" | "pro" | "hype" | "founder" | "documentary";

export interface VoiceMapping {
  voice: string;
  speed: number;
}
