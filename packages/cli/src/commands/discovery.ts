import { loadConfig } from "../config/load.js";
import { cachePaths } from "../cache/paths.js";
import { CacheStore } from "../cache/store.js";
import { StateMachine } from "../state/machine.js";
import { runDiscovery } from "../discovery/index.js";
import { detectFramework } from "../scan/framework.js";
import { parseRoutes } from "../scan/routes/index.js";
import { logger } from "../logger.js";
import { formatError, renderError } from "../ux/error.js";
import { formatDiscoveryMarkdown } from "../discovery/format.js";

export interface DiscoveryCommandOpts {
  cwd: string;
  rolesFile?: string;
  contextDir?: string[];
  routesFrom?: string;
  printMarkdown?: boolean;
  skipCrawl?: boolean;
}

function dedupe(input: string[]): string[] {
  return Array.from(new Set(input.filter(Boolean)));
}

export async function discoveryCommand(opts: DiscoveryCommandOpts): Promise<number> {
  const projectRoot = opts.cwd;
  let config;
  try { config = await loadConfig(projectRoot); }
  catch (err) {
    process.stderr.write(renderError(formatError(err, "discovery")));
    return 1;
  }
  const paths = cachePaths(projectRoot);
  const store = new CacheStore(paths);
  const sm = new StateMachine(projectRoot);
  await sm.load();
  await sm.recordCommand("discovery");

  try {
    const routeRoot = opts.routesFrom ?? projectRoot;
    const framework = await detectFramework(routeRoot, config.app.framework_hint);
    const routeEntries = await parseRoutes(framework, routeRoot);
    const routes = dedupe([
      "/",
      ...routeEntries.map((r) => r.path).filter((p) => !p.includes(":") && !p.includes("*"))
    ]);

    const { discovery, hash } = await runDiscovery({
      projectRoot,
      config,
      routes,
      ...(opts.rolesFile ? { rolesFileOverride: opts.rolesFile } : {}),
      ...(opts.contextDir ? { contextDirs: opts.contextDir } : {}),
      ...(opts.skipCrawl ? { skipCrawl: true } : {})
    });

    const target = paths.discovery(hash);
    const existing = await store.readJson(target);
    if (existing) {
      logger.info({ target }, "discovery cache hit");
    } else {
      await store.writeJson(target, discovery);
      logger.info(
        { target, roles: discovery.roles.length, routes: routes.length, sources: discovery.context_sources.length },
        "discovery written"
      );
    }
    await sm.markStageComplete("discovery");

    if (opts.printMarkdown !== false) {
      process.stdout.write(formatDiscoveryMarkdown(discovery, routes) + "\n");
    }
    return 0;
  } catch (err) {
    process.stderr.write(renderError(formatError(err, "discovery")));
    return 1;
  }
}
