import { describe, it, expect, vi, beforeEach } from "vitest";
import { readGraph } from "../../src/scan/graph.js";

const fakeGraph = {
  nodes: [
    { id: "n1", label: "Login.tsx::default", file: "src/pages/Login.tsx", kind: "function" },
    { id: "n2", label: "Dashboard.tsx::default", file: "src/pages/Dashboard.tsx", kind: "function" }
  ],
  links: [{ source: "n1", target: "n2" }]
};

vi.mock("execa", () => ({
  execa: vi.fn(async (_bin: string, args: string[]) => {
    if (args.includes("--json")) return { stdout: JSON.stringify(fakeGraph), exitCode: 0 };
    return { stdout: "", exitCode: 0 };
  })
}));

beforeEach(() => vi.clearAllMocks());

describe("readGraph", () => {
  it("reads nodes + links from graphify JSON output", async () => {
    const g = await readGraph("/some/root");
    expect(g.nodes).toHaveLength(2);
    expect(g.links).toHaveLength(1);
  });
  it("returns empty graph + warning when graphify is unavailable", async () => {
    const mod = await import("execa");
    (mod.execa as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("ENOENT"));
    const g = await readGraph("/some/root");
    expect(g.nodes).toEqual([]);
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.warnings[0].code).toBe("graphify-missing");
  });
});
