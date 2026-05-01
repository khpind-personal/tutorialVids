import { execa } from "execa";
import type { Warning } from "./types.js";

export interface GraphNode { id: string; label: string; file: string; kind: string; }
export interface GraphLink { source: string; target: string; }
export interface GraphResult {
  nodes: GraphNode[];
  links: GraphLink[];
  warnings: Warning[];
}

export async function readGraph(projectRoot: string): Promise<GraphResult> {
  try {
    const { stdout } = await execa("graphify", ["query", "--root", projectRoot, "--json"]);
    const parsed = JSON.parse(stdout) as { nodes?: GraphNode[]; links?: GraphLink[] };
    return { nodes: parsed.nodes ?? [], links: parsed.links ?? [], warnings: [] };
  } catch (err) {
    return {
      nodes: [],
      links: [],
      warnings: [{
        code: "graphify-missing",
        message: `code-graph unavailable: ${(err as Error).message}. Install graphifyy or run code-review-graph MCP.`
      }]
    };
  }
}
