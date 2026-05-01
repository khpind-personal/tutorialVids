import { chromium, type Page } from "playwright";
import type { ActionHint, Warning } from "./types.js";

export interface CrawlAuth {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
}

export interface CrawlOpts {
  baseUrl: string;
  maxDepth?: number;
  auth?: CrawlAuth;
  seedRoutes?: string[];
}

export interface CrawledPage {
  route: string;
  title: string;
  primary_actions: ActionHint[];
}

export interface CrawlResult {
  pages: CrawledPage[];
  warnings: Warning[];
}

function buildSelector(tagName: string, dt: string | null, name: string | null, id: string | null): string {
  if (dt) return `[data-test="${dt}"]`;
  if (name) return `${tagName}[name="${name}"]`;
  if (id) return `#${id}`;
  return tagName;
}

async function collectActions(page: Page): Promise<ActionHint[]> {
  const actions: ActionHint[] = [];

  const buttons = page.locator("button");
  const btnCount = Math.min(await buttons.count(), 5);
  for (let i = 0; i < btnCount; i++) {
    const b = buttons.nth(i);
    const dt = await b.getAttribute("data-test");
    const name = await b.getAttribute("name");
    const id = await b.getAttribute("id");
    const tag = "button";
    const text = ((await b.textContent()) ?? "").trim().slice(0, 60);
    const type = await b.getAttribute("type");
    actions.push({
      selector: buildSelector(tag, dt, name, id),
      label: text,
      kind: type === "submit" ? "submit" : "click"
    });
  }

  const links = page.locator("a[href]");
  const linkCount = Math.min(await links.count(), 5);
  for (let i = 0; i < linkCount; i++) {
    const a = links.nth(i);
    const dt = await a.getAttribute("data-test");
    const id = await a.getAttribute("id");
    const text = ((await a.textContent()) ?? "").trim().slice(0, 60);
    actions.push({
      selector: buildSelector("a", dt, null, id),
      label: text,
      kind: "link"
    });
  }

  const inputs = page.locator("input[name], textarea[name]");
  const inputCount = Math.min(await inputs.count(), 5);
  for (let i = 0; i < inputCount; i++) {
    const inp = inputs.nth(i);
    const dt = await inp.getAttribute("data-test");
    const name = await inp.getAttribute("name");
    const id = await inp.getAttribute("id");
    const tag = "input";
    actions.push({
      selector: buildSelector(tag, dt, name, id),
      label: (name ?? "input").slice(0, 60),
      kind: "input"
    });
  }

  return actions;
}

export async function crawl(opts: CrawlOpts): Promise<CrawlResult> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const warnings: Warning[] = [];

    if (opts.auth) {
      await page.goto(new URL(opts.auth.loginUrl, opts.baseUrl).toString());
      await page.fill(opts.auth.usernameSelector, opts.auth.username);
      await page.fill(opts.auth.passwordSelector, opts.auth.password);
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.click(opts.auth.submitSelector)
      ]);
    }

    const visited = new Map<string, CrawledPage>();
    const seeds: { route: string; depth: number }[] = [{ route: "/", depth: 0 }];
    if (opts.auth) seeds.push({ route: opts.auth.loginUrl, depth: 0 });
    for (const seed of opts.seedRoutes ?? []) {
      seeds.push({ route: seed, depth: 0 });
    }
    const queue: { route: string; depth: number }[] = seeds;
    const maxDepth = opts.maxDepth ?? 3;
    const baseOrigin = new URL(opts.baseUrl).origin;
    const loginUrl = opts.auth?.loginUrl ?? "/login";

    while (queue.length > 0) {
      const { route, depth } = queue.shift()!;
      if (visited.has(route)) continue;

      try {
        await page.goto(new URL(route, opts.baseUrl).toString(), { waitUntil: "networkidle" });
      } catch (err) {
        warnings.push({
          code: "crawl-nav-failed",
          message: `failed to navigate to ${route}: ${(err as Error).message}`
        });
        continue;
      }

      const finalRoute = new URL(page.url()).pathname;
      if (finalRoute !== route && finalRoute === loginUrl) {
        warnings.push({
          code: "redirect-to-login",
          message: `${route} redirected to ${finalRoute}`
        });
      }
      const title = await page.title();
      const actions = await collectActions(page);
      visited.set(finalRoute, { route: finalRoute, title, primary_actions: actions });

      if (depth >= maxDepth) continue;

      const linkEls = page.locator("a[href]");
      const linkCount = await linkEls.count();
      for (let i = 0; i < linkCount; i++) {
        const href = await linkEls.nth(i).getAttribute("href");
        if (!href) continue;
        try {
          const u = new URL(href, page.url());
          if (u.origin !== baseOrigin) continue;
          if (!visited.has(u.pathname)) queue.push({ route: u.pathname, depth: depth + 1 });
        } catch {}
      }
    }

    return { pages: Array.from(visited.values()), warnings };
  } finally {
    await browser.close();
  }
}
