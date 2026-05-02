import type { Depth, Segment, Tone, PickerInput } from "./types.js";

export function durationFor(depth: Depth): number {
  switch (depth) {
    case "low": return 30;
    case "medium": return 75;
    case "high": return 180;
  }
}

function makeId(index: number, pageId: string): string {
  const n = String(index + 1).padStart(2, "0");
  return `s${n}_${pageId}`;
}

export function pickSegments(input: PickerInput, depth: Depth, tone: Tone): Segment[] {
  let chosen = input.selected;
  if (chosen.length === 0) {
    const topN = input.defaultTopN ?? 5;
    chosen = [...input.pages]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topN)
      .map((p) => p.id);
  }
  const byId = new Map(input.pages.map((p) => [p.id, p]));
  const segments: Segment[] = [];
  chosen.forEach((pageId, i) => {
    const p = byId.get(pageId);
    if (!p) return;
    segments.push({
      id: makeId(i, pageId),
      page_id: pageId,
      page_route: p.route,
      page_title: p.title,
      depth,
      tone,
      target_duration_s: durationFor(depth),
      importance: p.importance,
      requires_auth: p.requires_auth
    });
  });
  return segments;
}
