import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SceneJson, SceneAction } from "../script/types.js";

export interface VerifyIssue {
  segment_id: string;
  beat?: string;
  severity: "error" | "warning";
  rule: string;
  message: string;
}

export interface VerifySegmentInput {
  scene: SceneJson;
  scriptDir: string;
  recordDir: string;
  composeDir: string;
}

export interface VerifySegmentResult {
  segment_id: string;
  issues: VerifyIssue[];
  metrics: {
    target_duration_ms: number;
    audio_duration_ms: number;
    last_audio_end_ms: number;
    chunks: number;
    phrase_beats: number;
    silent_gap_ms: number;
    overlap_ms: number;
    overruns: number;
    wpm: number;
  };
}

interface TimingFile {
  mode?: "beat" | "chunked";
  duration_ms: number;
  timing: { word: string; start_ms: number; end_ms: number }[];
  chunks?: { index: number; mp3_path: string; duration_ms: number; action_t_ms?: number; phrase?: string; beat?: string }[];
}

function safeReadJson<T>(path: string): Promise<T | null> {
  return readFile(path, "utf8").then((s) => JSON.parse(s) as T).catch(() => null);
}

function listPhraseActions(scene: SceneJson): SceneAction[] {
  return scene.actions.filter((a) => typeof a.narration_phrase === "string" && a.narration_phrase.trim().length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export async function verifySegment(input: VerifySegmentInput): Promise<VerifySegmentResult> {
  const issues: VerifyIssue[] = [];
  const segId = input.scene.segment_id;

  const timing = await safeReadJson<TimingFile>(join(input.scriptDir, "tts.timing.json"));
  const target_ms = input.scene.target_duration_s * 1000;
  const phraseActions = listPhraseActions(input.scene);

  if (!timing) {
    issues.push({ segment_id: segId, severity: "warning", rule: "tts-missing", message: "no tts.timing.json — was tts stage skipped?" });
    return {
      segment_id: segId,
      issues,
      metrics: {
        target_duration_ms: target_ms, audio_duration_ms: 0, last_audio_end_ms: 0,
        chunks: 0, phrase_beats: phraseActions.length,
        silent_gap_ms: target_ms, overlap_ms: 0, overruns: 0, wpm: 0
      }
    };
  }

  const chunks = (timing.chunks ?? []).slice().sort((a, b) => (a.action_t_ms ?? 0) - (b.action_t_ms ?? 0));
  const isBeatMode = timing.mode === "beat" || chunks.every((c) => typeof c.action_t_ms === "number");

  // Rule 1: total audio fits inside target video duration.
  let lastAudioEnd = 0;
  for (const c of chunks) {
    const start = isBeatMode ? (c.action_t_ms ?? 0) : 0;
    lastAudioEnd = Math.max(lastAudioEnd, start + c.duration_ms);
  }
  if (lastAudioEnd > target_ms + 200) {
    issues.push({
      segment_id: segId, severity: "error", rule: "audio-overruns-video",
      message: `last audio ends at ${lastAudioEnd}ms but segment target is ${target_ms}ms (over by ${lastAudioEnd - target_ms}ms)`
    });
  }

  // Rule 2: each beat phrase has a chunk within ±300ms of action.t_ms.
  let overruns = 0;
  if (isBeatMode) {
    for (const a of phraseActions) {
      const match = chunks.find((c) => c.action_t_ms !== undefined && Math.abs((c.action_t_ms ?? 0) - a.t_ms) <= 300);
      if (!match) {
        issues.push({
          segment_id: segId, ...(a.beat ? { beat: a.beat } : {}), severity: "error", rule: "beat-without-audio",
          message: `beat ${a.beat ?? a.t_ms+"ms"} declares narration_phrase but no audio chunk plays at t=${a.t_ms}ms`
        });
        continue;
      }
      const phraseStart = match.action_t_ms ?? 0;
      const phraseEnd = phraseStart + match.duration_ms;
      const sortedActions = input.scene.actions.slice().sort((x, y) => x.t_ms - y.t_ms);
      const next = sortedActions.find((x) => x.t_ms > a.t_ms);
      const window_end = next ? next.t_ms : target_ms;
      if (phraseEnd > window_end + 200) {
        overruns++;
        issues.push({
          segment_id: segId, ...(a.beat ? { beat: a.beat } : {}), severity: "warning", rule: "phrase-overruns-beat",
          message: `phrase audio (${match.duration_ms}ms) overruns this beat's window (next beat at ${window_end}ms, audio ends at ${phraseEnd}ms). Shorten the phrase or extend the beat.`
        });
      }
    }
  }

  // Rule 3: no audio chunks overlap.
  let overlapMs = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    const a = chunks[i]!;
    const b = chunks[i + 1]!;
    const aStart = isBeatMode ? (a.action_t_ms ?? 0) : 0;
    const aEnd = aStart + a.duration_ms;
    const bStart = isBeatMode ? (b.action_t_ms ?? 0) : aEnd;
    if (bStart < aEnd - 50) {
      overlapMs += aEnd - bStart;
      issues.push({
        segment_id: segId, severity: "error", rule: "audio-overlap",
        message: `chunk ${a.index} ends at ${aEnd}ms but chunk ${b.index} starts at ${bStart}ms (overlap ${aEnd - bStart}ms)`
      });
    }
  }

  // Rule 4: pacing — words per minute against actual audio duration.
  const totalWords = phraseActions.reduce((acc, a) => acc + wordCount(a.narration_phrase ?? ""), 0);
  const totalAudioS = chunks.reduce((acc, c) => acc + c.duration_ms, 0) / 1000;
  const wpm = totalAudioS > 0 ? Math.round((totalWords / totalAudioS) * 60) : 0;
  if (totalWords > 0 && totalAudioS > 0 && (wpm < 110 || wpm > 200)) {
    issues.push({
      segment_id: segId, severity: "warning", rule: "tts-pacing",
      message: `narration pacing ${wpm} wpm out of comfort band 110-200 (target ~150). Adjust phrase length or TTS speed.`
    });
  }

  // Rule 5: silent gap (target - audio coverage). Warn if > 30%.
  const totalAudioMs = chunks.reduce((acc, c) => acc + c.duration_ms, 0);
  const silentGap = Math.max(0, target_ms - totalAudioMs);
  if (target_ms > 0 && silentGap / target_ms > 0.3) {
    issues.push({
      segment_id: segId, severity: "warning", rule: "silent-gap",
      message: `${Math.round((silentGap/target_ms)*100)}% of segment has no narration (${silentGap}ms silent of ${target_ms}ms). Consider expanding phrases or shortening hold times.`
    });
  }

  // Rule 6: every beat with a highlight should have a phrase (otherwise the spotlight is unexplained).
  for (const a of input.scene.actions) {
    if (a.highlight?.target_selector && (!a.narration_phrase || a.narration_phrase.trim().length === 0)) {
      issues.push({
        segment_id: segId, ...(a.beat ? { beat: a.beat } : {}), severity: "warning", rule: "highlight-without-phrase",
        message: `beat ${a.beat ?? a.t_ms+"ms"} highlights an element but has no narration_phrase. Viewer sees spotlight + no audio explanation.`
      });
    }
  }

  return {
    segment_id: segId,
    issues,
    metrics: {
      target_duration_ms: target_ms,
      audio_duration_ms: totalAudioMs,
      last_audio_end_ms: lastAudioEnd,
      chunks: chunks.length,
      phrase_beats: phraseActions.length,
      silent_gap_ms: silentGap,
      overlap_ms: overlapMs,
      overruns,
      wpm
    }
  };
}

export interface VerifyAllInput {
  scenes: SceneJson[];
  scriptRoot: string;
  recordRoot: string;
  composeRoot: string;
}

export async function verifyAll(input: VerifyAllInput): Promise<VerifySegmentResult[]> {
  const out: VerifySegmentResult[] = [];
  for (const scene of input.scenes) {
    const r = await verifySegment({
      scene,
      scriptDir: join(input.scriptRoot, scene.segment_id),
      recordDir: join(input.recordRoot, scene.segment_id),
      composeDir: join(input.composeRoot, scene.segment_id)
    });
    out.push(r);
  }
  return out;
}
