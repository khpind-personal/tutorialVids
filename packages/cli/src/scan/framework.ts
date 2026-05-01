import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import type { Framework } from "./types.js";

const ALL: Framework[] = ["react-router", "next-app", "vite-router", "tanstack-router", "astro", "unknown"];

function isFramework(s: string): s is Framework { return (ALL as string[]).includes(s); }

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function detectFramework(projectRoot: string, hint?: string): Promise<Framework> {
  if (hint && isFramework(hint)) return hint;
  const pkgPath = join(projectRoot, "package.json");
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch { return "unknown"; }
  if (deps["next"]) {
    if (await pathExists(join(projectRoot, "app"))) return "next-app";
    return "next-app";
  }
  if (deps["@tanstack/react-router"]) return "tanstack-router";
  if (deps["astro"]) return "astro";
  if (deps["react-router-dom"]) return "react-router";
  return "unknown";
}
