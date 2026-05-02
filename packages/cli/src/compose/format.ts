export interface ComposeSummary {
  draft_path: string;
  segments: { id: string; role?: string; mp4: string; duration_ms: number }[];
  drafts?: { role: string; draft_path: string; segment_ids: string[]; duration_ms: number }[];
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
    ``
  ];

  if (s.drafts && s.drafts.length > 0) {
    lines.push(`**${s.drafts.length} per-role drafts** · total combined segments **${fmtDuration(s.total_duration_ms)}**`);
    lines.push("");
    for (const d of s.drafts) {
      lines.push(`## ${d.role}`);
      lines.push(`Draft: \`${d.draft_path}\` (480p, watermarked) · ${fmtDuration(d.duration_ms)}`);
      lines.push(`Segments: ${d.segment_ids.join(", ")}`);
      lines.push("");
    }
  } else {
    lines.push(`**Draft:** \`${s.draft_path}\` (480p, watermarked) · **${fmtDuration(s.total_duration_ms)}** total`);
    lines.push("");
  }

  lines.push(`Segments:`);
  for (const seg of s.segments) {
    const roleTag = seg.role && seg.role !== "common" ? ` [${seg.role}]` : seg.role === "common" ? " [common]" : "";
    lines.push(`- **${seg.id}**${roleTag} (${fmtDuration(seg.duration_ms)}) — \`${seg.mp4}\``);
  }
  lines.push("", "Approve, mark scenes for redo, or cancel before final render.");
  return lines.join("\n");
}
