import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CacheStore } from "../../src/cache/store.js";
import { cachePaths } from "../../src/cache/paths.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-")); });

describe("CacheStore", () => {
  it("writes JSON and reads it back", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    const target = paths.scan("abc");
    await store.writeJson(target, { foo: 1 });
    expect(existsSync(target)).toBe(true);
    expect(await store.readJson<{ foo: number }>(target)).toEqual({ foo: 1 });
  });
  it("returns null on cache miss", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    expect(await store.readJson(paths.scan("missing"))).toBeNull();
  });
  it("invalidates a single file", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    const target = paths.plan("p1");
    await store.writeJson(target, { ok: true });
    await store.invalidate(target);
    expect(existsSync(target)).toBe(false);
  });
  it("invalidates a whole stage directory", async () => {
    const paths = cachePaths(root);
    const store = new CacheStore(paths);
    await store.writeJson(paths.plan("p1"), { ok: 1 });
    await store.writeJson(paths.plan("p2"), { ok: 2 });
    await store.invalidateStage(join(paths.cache, "plan"));
    expect(existsSync(paths.plan("p1"))).toBe(false);
    expect(existsSync(paths.plan("p2"))).toBe(false);
  });
});
