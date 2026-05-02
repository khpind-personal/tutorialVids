import type { Plan } from "./types.js";

function fmtDuration(totalS: number): string {
  const mm = Math.floor(totalS / 60);
  const ss = totalS % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function formatPlanMarkdown(plan: Plan): string {
  const total = plan.segments.reduce((acc, s) => acc + s.target_duration_s, 0);
  const lines = [
    `# TutorialVid Plan — Gate 1`,
    ``,
    `**${plan.segments.length} segments** · depth: **${plan.depth}** · tone: **${plan.tone}** · total estimated **${fmtDuration(total)}**`,
    ``,
    `| ID | Route | Title | Auth | Importance | Duration |`,
    `|----|-------|-------|------|------------|----------|`,
    ...plan.segments.map((s) =>
      `| ${s.id} | ${s.page_route} | ${s.page_title} | ${s.requires_auth ? "yes" : "no"} | ${s.importance} | ${fmtDuration(s.target_duration_s)} |`
    ),
    ``,
    `Approve, edit, or cancel before proceeding to script generation.`
  ];
  return lines.join("\n");
}
