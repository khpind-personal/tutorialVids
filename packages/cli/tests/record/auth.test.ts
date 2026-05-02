import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyAuth } from "../../src/record/auth.js";

const fillMock = vi.fn();
const clickMock = vi.fn();
const gotoMock = vi.fn();
const waitForLoadStateMock = vi.fn();
const addCookiesMock = vi.fn();

const fakePage = { goto: gotoMock, fill: fillMock, click: clickMock, waitForLoadState: waitForLoadStateMock };
const fakeContext = { addCookies: addCookiesMock, storageState: vi.fn() };

beforeEach(() => {
  fillMock.mockReset(); clickMock.mockReset(); gotoMock.mockReset();
  waitForLoadStateMock.mockReset(); addCookiesMock.mockReset();
});

describe("applyAuth", () => {
  it("uses credentials mode (A) when env vars set", async () => {
    process.env.TV_USER = "demo"; process.env.TV_PASS = "demo";
    await applyAuth({
      mode: "credentials",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      credentials: {
        login_url: "/login",
        username_env: "TV_USER", password_env: "TV_PASS",
        username_selector: "[data-test=username]",
        password_selector: "[data-test=password]",
        submit_selector: "[data-test=submit]"
      }
    });
    expect(gotoMock).toHaveBeenCalled();
    expect(fillMock).toHaveBeenCalledTimes(2);
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("loads storageState (B) when path provided", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "tv-storage-"));
    const path = join(dir, "storage-state.json");
    writeFileSync(path, JSON.stringify({ cookies: [{ name: "session", value: "abc", url: "http://localhost:5173" }], origins: [] }));
    await applyAuth({
      mode: "storage_state",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      storageStatePath: path
    });
    expect(addCookiesMock).toHaveBeenCalled();
  });

  it("inline (C) is currently a no-op stub (Plan 4 will record the login flow)", async () => {
    await applyAuth({
      mode: "inline",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173"
    });
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("throws when credentials env vars missing in mode A", async () => {
    delete process.env.TV_USER; delete process.env.TV_PASS;
    await expect(applyAuth({
      mode: "credentials",
      page: fakePage as never, context: fakeContext as never,
      baseUrl: "http://localhost:5173",
      credentials: {
        login_url: "/login",
        username_env: "TV_USER", password_env: "TV_PASS",
        username_selector: "u", password_selector: "p", submit_selector: "s"
      }
    })).rejects.toThrow(/TV_USER|TV_PASS/);
  });
});
