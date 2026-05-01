import type { Framework, PageEntry, ScanResult, Warning, FlowEntry } from "./types.js";
import type { RouteEntry } from "./routes/index.js";
import type { CrawlResult } from "./crawl.js";
import type { GraphResult } from "./graph.js";

export interface ReconcileInput {
  framework: Framework;
  baseUrl: string;
  routes: RouteEntry[];
  crawl: CrawlResult;
  graph: GraphResult;
}

function routeToId(path: string): string {
  return path === "/" ? "root" : path.replace(/^\//, "").replace(/[\/:]/g, "-");
}

function mapElementToFile(routes: RouteEntry[], graph: GraphResult): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of routes) {
    if (!r.element) continue;
    const node = graph.nodes.find(
      (n) => n.label.startsWith(r.element + "::") || n.label.includes(`/${r.element}.`)
    );
    if (node) map.set(r.path, node.file);
  }
  return map;
}

function deriveFlows(pages: PageEntry[], graph: GraphResult): FlowEntry[] {
  const byNode = new Map(pages.filter((p) => p.graph_node).map((p) => [p.graph_node!, p]));
  const adj = new Map<string, string[]>();
  for (const link of graph.links) {
    if (!byNode.has(link.source) || !byNode.has(link.target)) continue;
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push(link.target);
  }
  const flows: FlowEntry[] = [];
  for (const [source, targets] of adj) {
    const sourcePage = byNode.get(source)!;
    for (const target of targets) {
      const targetPage = byNode.get(target)!;
      flows.push({
        id: `${sourcePage.id}-to-${targetPage.id}`,
        name: `${sourcePage.title} → ${targetPage.title}`,
        page_ids: [sourcePage.id, targetPage.id]
      });
    }
  }
  return flows;
}

function extractRouteFromAuthWarning(msg: string): string | null {
  const m = msg.match(/^(\/[^\s]+) redirected/);
  return m ? (m[1] ?? null) : null;
}

export function reconcile(input: ReconcileInput): ScanResult {
  const warnings: Warning[] = [...input.crawl.warnings, ...input.graph.warnings];
  const crawled = new Map(input.crawl.pages.map((p) => [p.route, p]));
  const routed = new Map(input.routes.map((r) => [r.path, r]));

  for (const [path] of routed) {
    if (!crawled.has(path)) {
      warnings.push({
        code: "route-not-mounted",
        message: `route ${path} declared in router but not reachable during crawl`
      });
    }
  }
  for (const [route] of crawled) {
    if (!routed.has(route)) {
      warnings.push({
        code: "crawled-not-routed",
        message: `crawler reached ${route} but no matching route declared`
      });
    }
  }

  const authRoutes = new Set(
    input.crawl.warnings
      .filter((w) => w.code === "redirect-to-login")
      .map((w) => extractRouteFromAuthWarning(w.message))
      .filter((s): s is string => s !== null)
  );

  const filesByPath = mapElementToFile(input.routes, input.graph);

  // Count total degree (inbound + outbound) per node id for hub-score (importance)
  const degreeCounts = new Map<string, number>();
  for (const link of input.graph.links) {
    degreeCounts.set(link.source, (degreeCounts.get(link.source) ?? 0) + 1);
    degreeCounts.set(link.target, (degreeCounts.get(link.target) ?? 0) + 1);
  }

  const pages: PageEntry[] = [];
  for (const r of input.routes) {
    const c = crawled.get(r.path);
    const file = filesByPath.get(r.path);
    const graphNode = file ? input.graph.nodes.find((n) => n.file === file)?.id : undefined;
    const importance = graphNode ? (degreeCounts.get(graphNode) ?? 0) : 0;

    const entry: PageEntry = {
      id: routeToId(r.path),
      route: r.path,
      title: c?.title ?? r.element ?? r.path,
      primary_actions: c?.primary_actions ?? [],
      requires_auth: authRoutes.has(r.path),
      needs_seed: false,
      importance
    };
    if (graphNode !== undefined) {
      entry.graph_node = graphNode;
    }
    pages.push(entry);
  }

  return {
    framework: input.framework,
    base_url: input.baseUrl,
    pages,
    flows: deriveFlows(pages, input.graph),
    warnings
  };
}
