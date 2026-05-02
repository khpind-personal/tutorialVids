import type { Page } from "playwright";
import type { SceneAction } from "../script/types.js";
import type { CursorRecorder } from "./cursor.js";

export interface RunActionsInput {
  page: Page;
  baseUrl: string;
  actions: SceneAction[];
  retry: number;
  retryBackoffMs: number;
  cursor: CursorRecorder;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withSelectorRetry<T>(
  fn: () => Promise<T>,
  retry: number,
  backoffMs: number,
  selector: string
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retry) {
        throw new Error(
          `selector ${selector} failed after ${retry + 1} attempts: ${(err as Error).message}`
        );
      }
      await sleep(backoffMs * Math.pow(2, attempt));
      attempt++;
    }
  }
}

export async function runActions(input: RunActionsInput): Promise<void> {
  for (const a of input.actions) {
    switch (a.type) {
      case "nav": {
        if (!a.url) throw new Error("nav action missing url");
        await input.page.goto(
          new URL(a.url, input.baseUrl).toString(),
          { waitUntil: "networkidle" }
        );
        break;
      }
      case "wait": {
        if (!a.selector) throw new Error("wait action missing selector");
        await withSelectorRetry(
          () =>
            input.page.waitForSelector(a.selector!, { timeout: 5000 }),
          input.retry,
          input.retryBackoffMs,
          a.selector
        );
        break;
      }
      case "type": {
        if (!a.selector || a.text === undefined)
          throw new Error("type action missing selector or text");
        await withSelectorRetry(
          () => input.page.fill(a.selector!, a.text!),
          input.retry,
          input.retryBackoffMs,
          a.selector
        );
        break;
      }
      case "click": {
        if (!a.selector) throw new Error("click action missing selector");
        await withSelectorRetry(
          () => input.page.click(a.selector!),
          input.retry,
          input.retryBackoffMs,
          a.selector
        );
        input.cursor.note("down", 0, 0);
        input.cursor.note("up", 0, 0);
        break;
      }
    }
  }
}
