import { glob } from "glob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface RouteEntry {
  path: string;
  element?: string;
}

const ROUTER_GLOB = ["src/**/router.{ts,tsx}", "src/**/routes.{ts,tsx}"];

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

function extractRoutesFromSource(text: string): RouteEntry[] {
  const cleaned = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const routeRe = /path:\s*["'`]([^"'`]+)["'`][^}]*?element:\s*([^]+?)(?=\s*},|\s*}\s*\])/g;
  const tagRe = /<\s*([A-Za-z_$][\w$]*)\b/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(cleaned)) !== null) {
    const path = m[1]!;
    const elementBlock = m[2] ?? "";
    let element: string | undefined;
    let tag: RegExpExecArray | null;
    tagRe.lastIndex = 0;
    while ((tag = tagRe.exec(elementBlock)) !== null) {
      const name = tag[1]!;
      if (!WRAPPERS.has(name)) {
        element = name;
        break;
      }
    }
    if (!element) continue;
    routes.push({ path, element });
  }
  return routes;
}

export async function parseReactRouterRoutes(projectRoot: string): Promise<RouteEntry[]> {
  const files = await collectFiles(projectRoot);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (!text.includes("createBrowserRouter") && !text.includes("createMemoryRouter")) continue;
    return extractRoutesFromSource(text);
  }
  return [];
}
