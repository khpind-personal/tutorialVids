import type { Page } from "playwright";
import type { SceneAction } from "../script/types.js";
import type { CursorRecorder } from "./cursor.js";

export interface LiveBbox {
  t_ms: number;
  beat?: string;
  selector: string;
  bbox: { x: number; y: number; w: number; h: number } | null;
  scroll: { x: number; y: number };
}

export interface RunActionsInput {
  page: Page;
  baseUrl: string;
  actions: SceneAction[];
  retry: number;
  retryBackoffMs: number;
  cursor: CursorRecorder;
  // Sink for live bboxes captured at action time. Optional — if provided, runner pushes one entry
  // per action that has a target_selector, holding the element's CSS-px bbox at the moment t_ms is reached.
  liveBboxes?: LiveBbox[];
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
  const start = Date.now();
  for (const a of input.actions) {
    const targetElapsed = typeof a.t_ms === "number" ? a.t_ms : 0;
    const actualElapsed = Date.now() - start;
    const delay = targetElapsed - actualElapsed;
    if (delay > 0) await sleep(delay);

    // BEFORE running the action, capture live bbox for any highlight target_selector.
    // This pins the bbox to the EXACT moment the highlight will show in the video.
    const hl = (a as { highlight?: { target_selector?: string }; beat?: string }).highlight;
    const targetSel = hl?.target_selector;
    if (targetSel && input.liveBboxes) {
      try {
        const bbox = await input.page.locator(targetSel).first().boundingBox({ timeout: 1000 });
        const scroll = await input.page.evaluate(() => ({ x: window.scrollX || 0, y: window.scrollY || 0 }));
        input.liveBboxes.push({
          t_ms: targetElapsed,
          ...((a as { beat?: string }).beat ? { beat: (a as { beat?: string }).beat as string } : {}),
          selector: targetSel,
          bbox: bbox ? { x: Math.round(bbox.x), y: Math.round(bbox.y), w: Math.round(bbox.width), h: Math.round(bbox.height) } : null,
          scroll
        });
      } catch {
        input.liveBboxes.push({ t_ms: targetElapsed, selector: targetSel, bbox: null, scroll: { x: 0, y: 0 } });
      }
    }

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
