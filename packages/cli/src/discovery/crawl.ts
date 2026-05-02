import { createHash } from "node:crypto";
import { chromium, type Page, type BrowserContext } from "playwright";
import { readFile } from "node:fs/promises";
import type { RoleAuth, RoleDef, RouteRoleCell } from "./types.js";

export interface DiscoveryCrawlInput {
  baseUrl: string;
  routes: string[];
  role: RoleDef;
  defaultLogin?: { url: string; usernameSelector: string; passwordSelector: string; submitSelector: string };
  viewport?: { width: number; height: number };
}

export interface DiscoveryCrawlResult {
  role_id: string;
  cells: Record<string, RouteRoleCell>;
}

function domHash(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
}

async function applyRoleAuth(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
  auth: RoleAuth,
  defaultLogin?: DiscoveryCrawlInput["defaultLogin"]
): Promise<void> {
  if (auth.mode === "storage_state") {
    const raw = await readFile(auth.storage_state_path, "utf8");
    const parsed = JSON.parse(raw) as {
      cookies?: Parameters<BrowserContext["addCookies"]>[0];
      origins?: { origin: string; localStorage: { name: string; value: string }[] }[];
    };
    if (parsed.cookies && parsed.cookies.length > 0) await context.addCookies(parsed.cookies);
    if (parsed.origins && parsed.origins.length > 0) {
      for (const o of parsed.origins) {
        await page.goto(o.origin);
        for (const item of o.localStorage) {
          await page.evaluate(
            ([k, v]) => window.localStorage.setItem(k, v),
            [item.name, item.value] as [string, string]
          );
        }
      }
    }
    return;
  }
  if (auth.mode === "credentials") {
    const username = process.env[auth.username_env];
    const password = process.env[auth.password_env];
    if (!username || !password) {
      throw new Error(`role auth env vars missing: ${auth.username_env} / ${auth.password_env}`);
    }
    const loginUrl = auth.login_url ?? defaultLogin?.url;
    const userSel = auth.username_selector ?? defaultLogin?.usernameSelector;
    const passSel = auth.password_selector ?? defaultLogin?.passwordSelector;
    const submitSel = auth.submit_selector ?? defaultLogin?.submitSelector;
    if (!loginUrl || !userSel || !passSel || !submitSel) {
      throw new Error(`role credentials auth missing login selectors and no defaultLogin provided`);
    }
    await page.goto(new URL(loginUrl, baseUrl).toString());
    await page.fill(userSel, username);
    await page.fill(passSel, password);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click(submitSel)
    ]);
    return;
  }
}

export async function discoveryCrawlForRole(input: DiscoveryCrawlInput): Promise<DiscoveryCrawlResult> {
  const browser = await chromium.launch();
  const cells: Record<string, RouteRoleCell> = {};
  try {
    const context = await browser.newContext({
      viewport: input.viewport ?? { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    await applyRoleAuth(context, page, input.baseUrl, input.role.auth, input.defaultLogin);

    for (const route of input.routes) {
      try {
        await page.goto(new URL(route, input.baseUrl).toString(), { waitUntil: "networkidle", timeout: 15000 });
      } catch {
        cells[route] = { accessible: false };
        continue;
      }
      const finalRoute = new URL(page.url()).pathname;
      const accessible = finalRoute === route || finalRoute.startsWith(route);
      const title = await page.title();
      const text = await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        const noScripts = Array.from(main.querySelectorAll("script,style,noscript"));
        for (const n of noScripts) n.remove();
        return (main.textContent ?? "").slice(0, 8000);
      });
      const navLabels = await page.evaluate(() => {
        const navEls = Array.from(document.querySelectorAll("nav a, nav button, [role=navigation] a, [role=navigation] button"));
        return navEls.map((n) => (n.textContent ?? "").trim()).filter(Boolean).slice(0, 25);
      });
      cells[route] = {
        accessible,
        title,
        dom_hash: domHash(text + "|" + navLabels.join("|")),
        unique_elements: navLabels,
        ...(finalRoute !== route ? { redirected_to: finalRoute } : {})
      };
    }
    return { role_id: input.role.id, cells };
  } finally {
    await browser.close();
  }
}
