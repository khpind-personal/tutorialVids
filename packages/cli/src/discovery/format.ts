import type { Discovery } from "./types.js";

export function formatDiscoveryMarkdown(discovery: Discovery, routes: string[]): string {
  const lines: string[] = [];
  lines.push(`# TutorialVid Discovery — Gate 0`);
  lines.push("");
  lines.push(`**${discovery.roles.length} roles · ${routes.length} routes · ${discovery.context_sources.length} context sources · ${discovery.common_pages.length} common pages**`);
  lines.push("");

  lines.push(`## Roles`);
  lines.push("");
  lines.push(`| ID | Label | Auth mode | Homepage |`);
  lines.push(`|----|-------|-----------|----------|`);
  for (const r of discovery.roles) {
    lines.push(`| ${r.id} | ${r.label} | ${r.auth.mode} | ${r.homepage_route ?? "-"} |`);
  }
  lines.push("");

  lines.push(`## Route × Role accessibility matrix`);
  lines.push("");
  const header = ["Route", ...discovery.roles.map((r) => r.id)];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`|${header.map(() => "----").join("|")}|`);
  for (const route of routes) {
    const cells = discovery.route_role_matrix[route] ?? {};
    const row = [route];
    for (const r of discovery.roles) {
      const c = cells[r.id];
      if (!c) { row.push("?"); continue; }
      if (!c.accessible) { row.push("✗"); continue; }
      const tag = discovery.common_pages.includes(route) ? "common" : (c.dom_hash ?? "?").slice(0, 6);
      row.push(`✓ ${tag}`);
    }
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");

  lines.push(`## Common pages`);
  lines.push("");
  if (discovery.common_pages.length === 0) lines.push("_(none — every route diverges across roles)_");
  else lines.push(discovery.common_pages.map((p) => `- ${p}`).join("\n"));
  lines.push("");

  lines.push(`## Context sources`);
  lines.push("");
  for (const s of discovery.context_sources) {
    lines.push(`- ${s.path} (${s.bytes}B)`);
  }
  lines.push("");
  lines.push(`Approve, edit roles, or cancel before scan/plan/script.`);

  return lines.join("\n");
}
