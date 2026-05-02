import { describe, it, expect, vi, beforeEach } from "vitest";
import { runActions } from "../../src/record/runner.js";
import type { SceneAction } from "../../src/script/types.js";
import type { CursorRecorder } from "../../src/record/cursor.js";

const gotoMock = vi.fn();
const clickMock = vi.fn();
const fillMock = vi.fn();
const waitForSelectorMock = vi.fn();
const evalMock = vi.fn();

const fakePage = {
  goto: gotoMock,
  click: clickMock,
  fill: fillMock,
  waitForSelector: waitForSelectorMock,
  evaluate: evalMock,
  url: () => "http://localhost:5173/dashboard",
};

const cursor = { note: vi.fn() } as unknown as CursorRecorder;

beforeEach(() => {
  gotoMock.mockReset();
  clickMock.mockReset();
  fillMock.mockReset();
  waitForSelectorMock.mockReset();
  evalMock.mockReset();
  (cursor.note as any).mockReset();
});

describe("runActions", () => {
  it("executes nav + click in order", async () => {
    const actions: SceneAction[] = [
      { t_ms: 0, type: "nav", url: "/dashboard" },
      { t_ms: 1000, type: "click", selector: "[data-test=x]" },
    ];
    await runActions({
      page: fakePage as never,
      baseUrl: "http://localhost:5173",
      actions,
      retry: 3,
      retryBackoffMs: 1,
      cursor,
    });
    expect(gotoMock).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("retries selector waits up to N times before failing", async () => {
    waitForSelectorMock
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(undefined);
    const actions: SceneAction[] = [
      { t_ms: 0, type: "wait", selector: "[data-test=flake]" },
    ];
    await runActions({
      page: fakePage as never,
      baseUrl: "http://localhost:5173",
      actions,
      retry: 3,
      retryBackoffMs: 1,
      cursor,
    });
    expect(waitForSelectorMock).toHaveBeenCalledTimes(3);
  });

  it("throws SelectorTimeout after exhausting retries", async () => {
    clickMock.mockRejectedValue(new Error("not found"));
    const actions: SceneAction[] = [
      { t_ms: 0, type: "click", selector: "[data-test=missing]" },
    ];
    await expect(
      runActions({
        page: fakePage as never,
        baseUrl: "http://localhost:5173",
        actions,
        retry: 2,
        retryBackoffMs: 1,
        cursor,
      })
    ).rejects.toThrow(/data-test=missing/);
  });
});
