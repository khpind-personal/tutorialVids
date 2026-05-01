import { join } from "node:path";

export function cachePaths(projectRoot: string) {
  const base = join(projectRoot, ".tutorialvid");
  const cache = join(base, "cache");
  return {
    base,
    cache,
    scan: (hash: string) => join(cache, "scan", `${hash}.json`),
    plan: (hash: string) => join(cache, "plan", `${hash}.json`),
    script: (segmentId: string, hash: string, ext: string) =>
      join(cache, "script", segmentId, `${hash}.${ext}`),
    record: (segmentId: string, hash: string, ext: string) =>
      join(cache, "record", segmentId, `${hash}.${ext}`),
    compose: (segmentId: string, hash: string) =>
      join(cache, "compose", segmentId, `${hash}.mp4`),
    final: (hash: string) => join(cache, "final", `${hash}.mp4`),
    state: () => join(base, "state.json"),
    storageState: () => join(base, "storage-state.json")
  };
}
