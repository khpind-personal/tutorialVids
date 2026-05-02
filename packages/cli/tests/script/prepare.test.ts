import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareWorkFiles } from "../../src/script/prepare.js";
import type { Plan } from "../../src/plan/types.js";
import type { ScanResult } from "../../src/scan/types.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-prep-")); });

const scan: ScanResult = {
  framework: "react-router", base_url: "http://x:5173",
  pages: [{ id: "dashboard", route: "/dashboard", title: "Dashboard", primary_actions: [], requires_auth: true, needs_seed: false, importance: 5 }],
  flows: [], warnings: []
};

const plan: Plan = {
  framework: "react-router", base_url: "http://x:5173",
  depth: "medium", tone: "friendly", language: "en-US",
  created_at: "2026-05-02T00:00:00Z",
  roles: [],
  segments: [{ id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
    depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true,
    role: "common", is_common: true }]
};

function makeAgent(p: string, name: string, body: string) {
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, `${name}.md`), `---\nname: ${name}\ndescription: x\nmodel: claude-sonnet-4-6\n---\n${body}`);
}

describe("prepareWorkFiles", () => {
  it("writes 1 work file per segment for the segment-author agent", async () => {
    const pluginRoot = join(root, "plugin");
    makeAgent(join(pluginRoot, "agents"), "tutorialvid-segment-author", "you are author");
    const cacheRoot = join(root, "cache");
    const result = await prepareWorkFiles({ plan, scan, pluginRoot, cacheRoot });
    expect(result.workFiles.length).toBe(1);
    expect(result.workFiles[0]?.role).toBe("author");
    const dirs = await readdir(join(cacheRoot, "script", "_work"));
    expect(dirs).toEqual(["s01_dashboard.author.json"]);
  });
});
