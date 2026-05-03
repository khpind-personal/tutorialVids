import type { VerifySegmentResult } from "./index.js";

function ms(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${n}ms`;
}

export function formatVerifyMarkdown(results: VerifySegmentResult[]): string {
  const lines: string[] = [];
  let errorCount = 0;
  let warnCount = 0;
  for (const r of results) {
    for (const i of r.issues) {
      if (i.severity === "error") errorCount++;
      else warnCount++;
    }
  }

  lines.push(`# TutorialVid Verify — Gate 5`);
  lines.push("");
  if (errorCount === 0 && warnCount === 0) {
    lines.push("**All checks passed.**");
  } else {
    lines.push(`**${errorCount} error(s) · ${warnCount} warning(s)** across ${results.length} segment(s).`);
  }
  lines.push("");

  for (const r of results) {
    const m = r.metrics;
    lines.push(`## ${r.segment_id}`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Target duration | ${ms(m.target_duration_ms)} |`);
    lines.push(`| Audio total | ${ms(m.audio_duration_ms)} |`);
    lines.push(`| Last audio ends at | ${ms(m.last_audio_end_ms)} |`);
    lines.push(`| Audio chunks | ${m.chunks} |`);
    lines.push(`| Phrase beats in scene | ${m.phrase_beats} |`);
    lines.push(`| Silent gap | ${ms(m.silent_gap_ms)} |`);
    lines.push(`| Overlap | ${ms(m.overlap_ms)} |`);
    lines.push(`| Pacing | ${m.wpm} wpm |`);
    lines.push("");
    if (r.issues.length === 0) {
      lines.push("✓ No issues.");
    } else {
      for (const i of r.issues) {
        const tag = i.severity === "error" ? "✖ ERROR" : "⚠ warn";
        const beat = i.beat ? ` [${i.beat}]` : "";
        lines.push(`- ${tag} \`${i.rule}\`${beat}: ${i.message}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
