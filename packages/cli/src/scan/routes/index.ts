import type { Framework } from "../types.js";
import { parseReactRouterRoutes, type RouteEntry } from "./react-router.js";

export type { RouteEntry };

export async function parseRoutes(framework: Framework, projectRoot: string): Promise<RouteEntry[]> {
  switch (framework) {
    case "react-router": return parseReactRouterRoutes(projectRoot);
    case "next-app":
    case "vite-router":
    case "tanstack-router":
    case "astro":
    case "unknown": return [];
  }
}
