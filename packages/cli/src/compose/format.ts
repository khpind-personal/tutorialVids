export interface ComposeSummary {
  draft_path: string;
  segments: { id: string; mp4: string; duration_ms: number }[];
  total_duration_ms: number;
}

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatComposeMarkdown(s: ComposeSummary): string {
  const lines = [
    `# TutorialVid Compose — Gate 4 (draft preview)`,
    ``,
    `**Draft:** \`${s.draft_path}\` (480p, watermarked) · **${fmtDuration(s.total_duration_ms)}** total`,
    ``,
    `Segments:`,
  ];
  for (const seg of s.segments) {
    lines.push(`- **${seg.id}** (${fmtDuration(seg.duration_ms)}) — \`${seg.mp4}\``);
  }
  lines.push("", "Approve, mark scenes for redo, or cancel before final render.");
  return lines.join("\n");
}
