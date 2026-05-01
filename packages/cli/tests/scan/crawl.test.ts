import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa, type ResultPromise } from "execa";
import { setTimeout as wait } from "node:timers/promises";
import { crawl } from "../../src/scan/crawl.js";

let server: ResultPromise | undefined;

beforeAll(async () => {
  server = execa("pnpm", ["--filter", "@tutorialvid/fixture-sample-app", "dev"], {
    stdout: "ignore", stderr: "ignore"
  });
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://localhost:5173/")).ok) return; } catch {}
    await wait(500);
  }
  throw new Error("sample-app dev server did not start in time");
}, 60_000);

afterAll(async () => { server?.kill("SIGTERM"); });

describe("crawl", () => {
  it("discovers /login, /dashboard, /profile after auth", async () => {
    const result = await crawl({
      baseUrl: "http://localhost:5173",
      maxDepth: 3,
      auth: {
        loginUrl: "/login",
        usernameSelector: "[data-test=username]",
        passwordSelector: "[data-test=password]",
        submitSelector: "[data-test=submit]",
        username: "demo",
        password: "demo"
      }
    });
    const routes = result.pages.map(p => p.route).sort();
    expect(routes).toEqual(expect.arrayContaining(["/dashboard", "/login", "/profile"]));
    expect(result.pages.find(p => p.route === "/dashboard")?.title.toLowerCase()).toContain("dashboard");
  }, 60_000);
});
