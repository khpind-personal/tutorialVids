import { dirname } from "node:path";
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import type { cachePaths } from "./paths.js";

type Paths = ReturnType<typeof cachePaths>;

export class CacheStore {
  constructor(private paths: Paths) {}
  async writeJson(target: string, payload: unknown): Promise<void> {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(payload, null, 2), "utf8");
  }
  async readJson<T = unknown>(target: string): Promise<T | null> {
    try { await access(target); } catch { return null; }
    return JSON.parse(await readFile(target, "utf8")) as T;
  }
  async invalidate(target: string): Promise<void> {
    await rm(target, { force: true });
  }
  async invalidateStage(stageDir: string): Promise<void> {
    await rm(stageDir, { recursive: true, force: true });
  }
}
