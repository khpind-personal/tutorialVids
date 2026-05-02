import type { RecordSegmentResult } from "./types.js";

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatRecordMarkdown(segs: RecordSegmentResult[]): string {
  const lines = [
    `# TutorialVid Recording — Gate 3 (raw clips)`,
    ``,
  ];
  for (const s of segs) {
    lines.push(
      `- **${s.segment_id}** (${fmtDuration(s.duration_ms)}) — \`${s.mp4_path}\``
    );
  }
  lines.push("", "Mark any segment 'redo' before proceeding to compose.");
  return lines.join("\n");
}
