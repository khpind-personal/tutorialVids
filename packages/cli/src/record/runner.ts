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
        const sel = a.selector;
        const box = await withSelectorRetry(
          async () => {
            const handle = await input.page.waitForSelector(sel, { timeout: 5000 });
            return handle ? await handle.boundingBox() : null;
          },
          input.retry,
          input.retryBackoffMs,
          sel
        );
        const x = box ? Math.round(box.x + box.width / 2) : 0;
        const y = box ? Math.round(box.y + box.height / 2) : 0;
        input.cursor.note("move", x, y);
        await withSelectorRetry(
          () => input.page.click(sel),
          input.retry,
          input.retryBackoffMs,
          sel
        );
        input.cursor.note("down", x, y);
        input.cursor.note("up", x, y);
        break;
      }
    }
  }
}
