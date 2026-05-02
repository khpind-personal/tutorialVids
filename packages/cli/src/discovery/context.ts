import { readFile, readdir, stat } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { ContextSource } from "./types.js";

const DEFAULT_INCLUDE_FILES = [
  "CLAUDE.md",
  "README.md",
  "ARCHITECTURE.md"
];

const DEFAULT_INCLUDE_DIRS = [
  "docs",
  "Workblock/40-Codebase",
  "Vault/40-Codebase"
];

const MAX_FILE_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024;
const MAX_FILES = 40;

export interface CollectInput {
  projectRoot: string;
  extraDirs?: string[];
}

export interface CollectOutput {
  sources: ContextSource[];
  corpus: string;
}

async function tryStat(path: string) {
  try { return await stat(path); } catch { return null; }
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(curr: string, depth: number): Promise<void> {
    if (depth > 4) return;
    let entries;
    try { entries = await readdir(curr, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.name === "node_modules" || e.name === "dist" || e.name === "build") continue;
      const p = join(curr, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(p);
    }
  }
  await walk(dir, 0);
  return out;
}

export async function collectContext(input: CollectInput): Promise<CollectOutput> {
  const sources: ContextSource[] = [];
  const parts: string[] = [];
  let total = 0;

  const seen = new Set<string>();
  async function ingest(path: string, relLabel: string): Promise<boolean> {
    if (seen.has(path)) return false;
    seen.add(path);
    if (sources.length >= MAX_FILES) return false;
    if (total >= MAX_TOTAL_BYTES) return false;
    const st = await tryStat(path);
    if (!st || !st.isFile()) return false;
    let raw = await readFile(path, "utf8");
    if (raw.length > MAX_FILE_BYTES) raw = raw.slice(0, MAX_FILE_BYTES) + "\n…(truncated)\n";
    const remaining = MAX_TOTAL_BYTES - total;
    if (raw.length > remaining) raw = raw.slice(0, remaining) + "\n…(truncated)\n";
    parts.push(`\n\n# === ${relLabel} ===\n\n${raw}`);
    sources.push({ path: relLabel, bytes: raw.length });
    total += raw.length;
    return true;
  }

  for (const f of DEFAULT_INCLUDE_FILES) {
    await ingest(join(input.projectRoot, f), f);
  }
  const dirs = [...DEFAULT_INCLUDE_DIRS, ...(input.extraDirs ?? [])];
  for (const d of dirs) {
    const abs = isAbsolute(d) ? d : join(input.projectRoot, d);
    const files = await listMarkdownFiles(abs);
    files.sort();
    for (const f of files) {
      if (sources.length >= MAX_FILES || total >= MAX_TOTAL_BYTES) break;
      const rel = f.startsWith(input.projectRoot) ? f.slice(input.projectRoot.length + 1) : f;
      await ingest(f, rel);
    }
  }

  return { sources, corpus: parts.join("") };
}
