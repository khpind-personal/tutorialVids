import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

export type AgentRole = "writer" | "director" | "author";

export interface WorkFile {
  segment_id: string;
  agent_name: string;
  system_prompt: string;
  user_payload: unknown;
}

function workPath(cacheRoot: string, segmentId: string, role: AgentRole): string {
  return join(cacheRoot, "script", "_work", `${segmentId}.${role}.json`);
}

function resultPath(cacheRoot: string, segmentId: string, role: AgentRole): string {
  return join(cacheRoot, "script", "_result", `${segmentId}.${role}.json`);
}

export async function writeWorkFile(cacheRoot: string, segmentId: string, role: AgentRole, work: WorkFile): Promise<string> {
  const path = workPath(cacheRoot, segmentId, role);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(work, null, 2), "utf8");
  return path;
}

export async function readWorkFile(path: string): Promise<WorkFile> {
  return JSON.parse(await readFile(path, "utf8")) as WorkFile;
}

export async function writeResultFile(cacheRoot: string, segmentId: string, role: AgentRole, result: unknown): Promise<string> {
  const path = resultPath(cacheRoot, segmentId, role);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(result, null, 2), "utf8");
  return path;
}

export async function readResultFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function validateNarrationResult(x: unknown): boolean {
  const n = x as { text?: unknown; ssml?: unknown; alignments?: unknown };
  return !!n && typeof n.text === "string" && typeof n.ssml === "string" && Array.isArray(n.alignments);
}

export function validateSceneResult(x: unknown): boolean {
  const s = x as { actions?: unknown[] };
  return !!s && Array.isArray(s.actions) && s.actions.length > 0;
}

export function validateAuthorResult(x: unknown): boolean {
  const r = x as { narration?: unknown; actions?: unknown };
  return (
    !!r &&
    validateNarrationResult(r.narration) &&
    Array.isArray(r.actions) &&
    (r.actions as unknown[]).length > 0
  );
}
