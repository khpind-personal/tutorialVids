import { describe, it, expect } from "vitest";
import { cachePaths } from "../../src/cache/paths.js";

describe("cachePaths", () => {
  const root = "/repo";
  it("scan path", () => {
    expect(cachePaths(root).scan("abc1234567890def"))
      .toBe("/repo/.tutorialvid/cache/scan/abc1234567890def.json");
  });
  it("plan path", () => {
    expect(cachePaths(root).plan("h1")).toBe("/repo/.tutorialvid/cache/plan/h1.json");
  });
  it("script segment artifact path", () => {
    expect(cachePaths(root).script("s01", "h1", "scene.json"))
      .toBe("/repo/.tutorialvid/cache/script/s01/h1.scene.json");
  });
  it("record segment mp4 path", () => {
    expect(cachePaths(root).record("s01", "h1", "mp4"))
      .toBe("/repo/.tutorialvid/cache/record/s01/h1.mp4");
  });
  it("state path", () => {
    expect(cachePaths(root).state()).toBe("/repo/.tutorialvid/state.json");
  });
});
