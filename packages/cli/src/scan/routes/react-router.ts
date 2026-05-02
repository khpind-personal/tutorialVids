import { glob } from "glob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface RouteEntry {
  path: string;
  element?: string;
}

const ROUTER_GLOB = [
  "src/**/router.{ts,tsx}",
  "src/**/routes.{ts,tsx}",
  "src/App.{ts,tsx}",
  "src/app.{ts,tsx}"
];

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const pattern of ROUTER_GLOB) {
    const files = await glob(pattern, { cwd: root });
    for (const f of files) {
      out.push(join(root, f));
    }
  }
  return out;
}

const WRAPPERS = new Set(["RequireAuth", "ProtectedRoute", "PrivateRoute", "Suspense", "ErrorBoundary", "Navigate"]);

function extractRoutesFromConfigArray(text: string): RouteEntry[] {
  const routeRe = /path:\s*["'`]([^"'`]+)["'`][^}]*?element:\s*([^]+?)(?=\s*},|\s*}\s*\])/g;
  const tagRe = /<\s*([A-Za-z_$][\w$]*)\b/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(text)) !== null) {
    const path = m[1]!;
    const elementBlock = m[2] ?? "";
    let element: string | undefined;
    let tag: RegExpExecArray | null;
    tagRe.lastIndex = 0;
    while ((tag = tagRe.exec(elementBlock)) !== null) {
      const name = tag[1]!;
      if (!WRAPPERS.has(name)) { element = name; break; }
    }
    if (!element) continue;
    routes.push({ path, element });
  }
  return routes;
}

function extractRoutesFromJsx(text: string): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const re = /<Route\s+[^>]*?path\s*=\s*["'`]([^"'`]+)["'`][^>]*?(?:element\s*=\s*\{?\s*<\s*([A-Za-z_$][\w$]*)|\/?>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1]!;
    const element = m[2];
    if (element && WRAPPERS.has(element)) continue;
    if (path.startsWith("*")) continue;
    routes.push({ path, ...(element ? { element } : {}) });
  }
  return routes;
}

function dedupeByPath(routes: RouteEntry[]): RouteEntry[] {
  const seen = new Set<string>();
  const out: RouteEntry[] = [];
  for (const r of routes) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    out.push(r);
  }
  return out;
}

function extractRoutesFromSource(text: string): RouteEntry[] {
  const cleaned = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const config = extractRoutesFromConfigArray(cleaned);
  const jsx = extractRoutesFromJsx(cleaned);
  return dedupeByPath([...config, ...jsx]);
}

export async function parseReactRouterRoutes(projectRoot: string): Promise<RouteEntry[]> {
  const files = await collectFiles(projectRoot);
  const all: RouteEntry[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const looksLikeRouter =
      text.includes("createBrowserRouter") ||
      text.includes("createMemoryRouter") ||
      /<Route\s+[^>]*path\s*=/.test(text);
    if (!looksLikeRouter) continue;
    all.push(...extractRoutesFromSource(text));
  }
  return dedupeByPath(all);
}
