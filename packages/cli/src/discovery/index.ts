import { hashInputs } from "../cache/hash.js";
import { collectContext } from "./context.js";
import { loadRolesFile } from "./role-source.js";
import { discoveryCrawlForRole } from "./crawl.js";
import type { Discovery, RouteRoleCell } from "./types.js";
import type { Config } from "../config/schema.js";
import { logger } from "../logger.js";

export interface RunDiscoveryInput {
  projectRoot: string;
  config: Config;
  routes: string[];
  rolesFileOverride?: string;
  contextDirs?: string[];
  skipCrawl?: boolean;
}

export async function runDiscovery(input: RunDiscoveryInput): Promise<{ discovery: Discovery; hash: string }> {
  const roles = await loadRolesFile(input.projectRoot, input.rolesFileOverride);
  const ctx = await collectContext({
    projectRoot: input.projectRoot,
    ...(input.contextDirs ? { extraDirs: input.contextDirs } : {})
  });

  const matrix: Record<string, Record<string, RouteRoleCell>> = {};
  for (const r of input.routes) matrix[r] = {};

  if (!input.skipCrawl) {
    const defaultLogin = input.config.auth.credentials
      ? {
          url: input.config.auth.credentials.login_url,
          usernameSelector: input.config.auth.credentials.username_selector,
          passwordSelector: input.config.auth.credentials.password_selector,
          submitSelector: input.config.auth.credentials.submit_selector
        }
      : undefined;

    for (const role of roles) {
      try {
        const res = await discoveryCrawlForRole({
          baseUrl: input.config.app.dev_url,
          routes: input.routes,
          role,
          ...(defaultLogin ? { defaultLogin } : {}),
          viewport: input.config.record.viewport
        });
        for (const route of input.routes) {
          const cells = matrix[route]!;
          cells[role.id] = res.cells[route] ?? { accessible: false };
        }
        logger.info({ role: role.id, routes: Object.keys(res.cells).length }, "discovery crawl ok");
      } catch (err) {
        logger.warn({ role: role.id, err: (err as Error).message }, "discovery crawl failed for role");
        for (const route of input.routes) {
          const cells = matrix[route]!;
          cells[role.id] = { accessible: false };
        }
      }
    }
  }

  const common: string[] = [];
  for (const route of input.routes) {
    const cells = matrix[route] ?? {};
    const hashes = Object.values(cells)
      .filter((c) => c.accessible && c.dom_hash)
      .map((c) => c.dom_hash!);
    if (hashes.length === roles.length && new Set(hashes).size === 1) {
      common.push(route);
    }
  }

  const discovery: Discovery = {
    context_sources: ctx.sources,
    context_corpus: ctx.corpus,
    roles,
    route_role_matrix: matrix,
    common_pages: common,
    created_at: new Date().toISOString()
  };

  const hash = hashInputs({
    role_ids: roles.map((r) => r.id),
    routes: input.routes,
    sources: ctx.sources.map((s) => s.path),
    corpus_len: ctx.corpus.length,
    matrix_summary: Object.fromEntries(
      Object.entries(matrix).map(([rt, cells]) => [
        rt,
        Object.fromEntries(Object.entries(cells).map(([rid, c]) => [rid, c.dom_hash ?? (c.accessible ? "acc" : "no")]))
      ])
    )
  });
  return { discovery, hash };
}
