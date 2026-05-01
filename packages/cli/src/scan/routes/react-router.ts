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

function extractRoutesFromSource(text: string): RouteEntry[] {
  const cleaned = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /path:\s*["'`]([^"'`]+)["'`][^}]*?element:\s*<\s*([A-Za-z_$][\w$]*)\b/g;
  const routes: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const [, path, element] = m;
    if (element === "Navigate") continue;
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
