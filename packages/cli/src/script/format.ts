import type { SceneJson } from "./types.js";

export function formatScriptMarkdown(scenes: SceneJson[]): string {
  const lines = [`# TutorialVid Script — Gate 2`, ``, `${scenes.length} segment(s):`, ``];
  for (const s of scenes) {
    lines.push(`## ${s.segment_id} — ${s.page_id}`);
    lines.push("");
    lines.push("**Narration:**");
    lines.push("");
    lines.push(s.narration.text);
    lines.push("");
    lines.push(`**Actions:** ${s.actions.length}, **target:** ${s.target_duration_s}s, **depth:** ${s.depth}, **tone:** ${s.tone}`);
    lines.push("");
  }
  return lines.join("\n");
}
