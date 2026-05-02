export function msToSrtTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)},${pad(millis, 3)}`;
}

export interface SrtWord { word: string; start_ms: number; end_ms: number; }

export function wordsToSrt(words: SrtWord[], wordsPerCue = 5): string {
  if (words.length === 0) return "";
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    const start = group[0]!.start_ms;
    const end = group[group.length - 1]!.end_ms;
    const text = group.map((w) => w.word).join(" ");
    const idx = Math.floor(i / wordsPerCue) + 1;
    cues.push(`${idx}\n${msToSrtTimestamp(start)} --> ${msToSrtTimestamp(end)}\n${text}`);
  }
  return cues.join("\n\n");
}
