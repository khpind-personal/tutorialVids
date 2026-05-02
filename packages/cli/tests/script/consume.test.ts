import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { consumeSegmentResults } from "../../src/script/consume.js";
import type { Segment } from "../../src/plan/types.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-cons-")); });

const seg: Segment = {
  id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
  depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true
};

describe("consumeSegmentResults", () => {
  it("reads writer + director results, persists scene.json + txt + ssml", async () => {
    const cacheRoot = join(root, "cache");
    mkdirSync(join(cacheRoot, "script", "_result"), { recursive: true });
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.writer.json"),
      JSON.stringify({ text: "Welcome.", ssml: "<speak>Welcome.</speak>", alignments: [] }));
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.director.json"),
      JSON.stringify({ actions: [{ t_ms: 0, type: "nav", url: "/dashboard" }] }));
    const r = await consumeSegmentResults({ segment: seg, cacheRoot });
    expect(r.scene.segment_id).toBe("s01_dashboard");
    expect(r.scene.actions).toHaveLength(1);
    const txt = await readFile(join(cacheRoot, "script", "s01_dashboard", `${r.hash}.txt`), "utf8");
    expect(txt).toBe("Welcome.");
  });

  it("throws on missing writer result", async () => {
    const cacheRoot = join(root, "cache");
    await expect(consumeSegmentResults({ segment: seg, cacheRoot })).rejects.toThrow(/writer/i);
  });

  it("throws on invalid director result (empty actions)", async () => {
    const cacheRoot = join(root, "cache");
    mkdirSync(join(cacheRoot, "script", "_result"), { recursive: true });
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.writer.json"),
      JSON.stringify({ text: "x", ssml: "<speak>x</speak>", alignments: [] }));
    writeFileSync(join(cacheRoot, "script", "_result", "s01_dashboard.director.json"),
      JSON.stringify({ actions: [] }));
    await expect(consumeSegmentResults({ segment: seg, cacheRoot })).rejects.toThrow(/empty|actions/i);
  });
});
