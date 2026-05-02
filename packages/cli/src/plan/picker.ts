import type { Depth, Segment, Tone, PickerInput } from "./types.js";
import type { Discovery } from "../discovery/types.js";

export function durationFor(depth: Depth): number {
  switch (depth) {
    case "low": return 30;
    case "medium": return 75;
    case "high": return 180;
  }
}

function makeId(index: number, pageId: string, roleId: string): string {
  const n = String(index + 1).padStart(2, "0");
  return roleId === "common" ? `s${n}_${pageId}` : `s${n}_${pageId}_${roleId}`;
}

export interface PickInput extends PickerInput {
  discovery?: Discovery;
  selectedRoles?: string[];
}

export function pickSegments(input: PickInput, depth: Depth, tone: Tone): Segment[] {
  let chosen = input.selected;
  if (chosen.length === 0) {
    const topN = input.defaultTopN ?? 5;
    chosen = [...input.pages]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topN)
      .map((p) => p.id);
  }
  const byId = new Map(input.pages.map((p) => [p.id, p]));

  if (!input.discovery || input.discovery.roles.length === 0) {
    const segments: Segment[] = [];
    chosen.forEach((pageId, i) => {
      const p = byId.get(pageId);
      if (!p) return;
      segments.push({
        id: makeId(i, pageId, "common"),
        page_id: pageId,
        page_route: p.route,
        page_title: p.title,
        depth,
        tone,
        target_duration_s: durationFor(depth),
        importance: p.importance,
        requires_auth: p.requires_auth,
        role: "common",
        is_common: true
      });
    });
    return segments;
  }

  const allRoles = input.discovery.roles;
  const includedRoles = input.selectedRoles && input.selectedRoles.length > 0
    ? allRoles.filter((r) => input.selectedRoles!.includes(r.id))
    : allRoles;

  const segments: Segment[] = [];
  let pairIndex = 0;
  for (const pageId of chosen) {
    const p = byId.get(pageId);
    if (!p) continue;
    const cells = input.discovery.route_role_matrix[p.route] ?? {};
    const isCommon = input.discovery.common_pages.includes(p.route);

    if (isCommon) {
      segments.push({
        id: makeId(pairIndex++, pageId, "common"),
        page_id: pageId,
        page_route: p.route,
        page_title: p.title,
        depth,
        tone,
        target_duration_s: durationFor(depth),
        importance: p.importance,
        requires_auth: p.requires_auth,
        role: "common",
        is_common: true
      });
      continue;
    }

    for (const role of includedRoles) {
      const cell = cells[role.id];
      if (cell && !cell.accessible) continue;
      segments.push({
        id: makeId(pairIndex++, pageId, role.id),
        page_id: pageId,
        page_route: p.route,
        page_title: p.title,
        depth,
        tone,
        target_duration_s: durationFor(depth),
        importance: p.importance,
        requires_auth: p.requires_auth,
        role: role.id,
        role_label: role.label,
        is_common: false
      });
    }
  }
  return segments;
}
