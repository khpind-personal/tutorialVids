import type { TTSChunk } from "./types.js";

const SPEAK_OPEN = "<speak>";
const SPEAK_CLOSE = "</speak>";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function unwrapSpeak(ssml: string): string {
  const trimmed = ssml.trim();
  if (trimmed.startsWith(SPEAK_OPEN) && trimmed.endsWith(SPEAK_CLOSE)) {
    return trimmed.slice(SPEAK_OPEN.length, trimmed.length - SPEAK_CLOSE.length);
  }
  return trimmed;
}

function wrapSpeak(s: string): string {
  return `${SPEAK_OPEN}${s}${SPEAK_CLOSE}`;
}

export function chunkSsml(ssml: string, maxChars: number): TTSChunk[] {
  const inner = unwrapSpeak(ssml);
  if (inner.length <= maxChars) {
    return [{ index: 0, ssml: wrapSpeak(inner), text: stripTags(inner) }];
  }

  // Pass 1: split at <break ...> tags
  const breakRe = /<break[^>]*\/>/g;
  const parts = inner.split(breakRe).map((p) => p.trim()).filter((p) => p.length > 0);

  // If still over the limit per part, split each part at sentence boundaries
  const final: string[] = [];
  for (const p of parts) {
    if (p.length <= maxChars) {
      final.push(p);
      continue;
    }
    const sentences = p.split(/(?<=[.!?])\s+/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).trim().length > maxChars && buf.length > 0) {
        final.push(buf.trim());
        buf = s;
      } else {
        buf = (buf + " " + s).trim();
      }
    }
    if (buf.length > 0) {
      final.push(buf);
    }
  }

  // Coalesce neighbouring parts when their combined length is still under the limit
  const coalesced: string[] = [];
  for (const f of final) {
    const last = coalesced[coalesced.length - 1];
    if (last !== undefined && (last.length + f.length + 1) <= maxChars) {
      coalesced[coalesced.length - 1] = `${last} ${f}`;
    } else {
      coalesced.push(f);
    }
  }

  return coalesced.map((c, i) => ({ index: i, ssml: wrapSpeak(c), text: stripTags(c) }));
}
