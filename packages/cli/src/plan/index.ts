import { readFile } from "node:fs/promises";
import { hashInputs } from "../cache/hash.js";
import type { Config } from "../config/schema.js";
import type { ScanResult } from "../scan/types.js";
import type { Discovery } from "../discovery/types.js";
import { pickSegments } from "./picker.js";
import type { Plan } from "./types.js";

export interface RunPlanInput {
  scan: ScanResult;
  config: Config;
  selectedPageIds: string[];
  defaultTopN?: number;
  discovery?: Discovery;
  selectedRoles?: string[];
}

export async function runPlan(input: RunPlanInput): Promise<{ plan: Plan; hash: string }> {
  const segments = pickSegments(
    {
      pages: input.scan.pages.map((p) => ({
        id: p.id, route: p.route, title: p.title, importance: p.importance, requires_auth: p.requires_auth
      })),
      selected: input.selectedPageIds,
      ...(input.defaultTopN !== undefined ? { defaultTopN: input.defaultTopN } : {}),
      ...(input.discovery ? { discovery: input.discovery } : {}),
      ...(input.selectedRoles ? { selectedRoles: input.selectedRoles } : {})
    },
    input.config.script.depth,
    input.config.script.tone
  );
  const roles = input.discovery?.roles.map((r) => ({ id: r.id, label: r.label })) ?? [];
  const plan: Plan = {
    framework: input.scan.framework,
    base_url: input.scan.base_url,
    depth: input.config.script.depth,
    tone: input.config.script.tone,
    language: input.config.script.language,
    segments,
    roles,
    created_at: new Date().toISOString()
  };
  const hash = hashInputs({
    framework: plan.framework,
    base_url: plan.base_url,
    depth: plan.depth,
    tone: plan.tone,
    language: plan.language,
    segment_ids: segments.map((s) => s.id),
    role_ids: roles.map((r) => r.id)
  });
  return { plan, hash };
}

export async function readScanFromCache(scanCacheDir: string, hash: string): Promise<ScanResult> {
  const path = `${scanCacheDir}/${hash}.json`;
  return JSON.parse(await readFile(path, "utf8")) as ScanResult;
}
