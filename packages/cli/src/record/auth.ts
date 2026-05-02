import { readFile } from "node:fs/promises";
import type { Page, BrowserContext } from "playwright";
import type { AuthMode } from "./types.js";

export interface AuthCredentials {
  login_url: string;
  username_env: string;
  password_env: string;
  username_selector: string;
  password_selector: string;
  submit_selector: string;
}

export interface ApplyAuthInput {
  mode: AuthMode;
  page: Page;
  context: BrowserContext;
  baseUrl: string;
  credentials?: AuthCredentials;
  storageStatePath?: string;
}

export async function applyAuth(input: ApplyAuthInput): Promise<void> {
  switch (input.mode) {
    case "credentials": {
      if (!input.credentials) throw new Error("credentials block missing");
      const u = process.env[input.credentials.username_env];
      const p = process.env[input.credentials.password_env];
      if (!u || !p) throw new Error(`${input.credentials.username_env} or ${input.credentials.password_env} not set`);
      await input.page.goto(new URL(input.credentials.login_url, input.baseUrl).toString());
      await input.page.fill(input.credentials.username_selector, u);
      await input.page.fill(input.credentials.password_selector, p);
      await Promise.all([
        input.page.waitForLoadState("networkidle"),
        input.page.click(input.credentials.submit_selector)
      ]);
      return;
    }
    case "storage_state": {
      if (!input.storageStatePath) throw new Error("storage_state mode requires storageStatePath");
      const raw = await readFile(input.storageStatePath, "utf8");
      const parsed = JSON.parse(raw) as { cookies?: Parameters<BrowserContext["addCookies"]>[0] };
      if (parsed.cookies && parsed.cookies.length > 0) {
        await input.context.addCookies(parsed.cookies);
      }
      return;
    }
    case "inline":
      return;
  }
}
