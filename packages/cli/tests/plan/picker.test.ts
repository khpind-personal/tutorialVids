import { describe, it, expect } from "vitest";
import { pickSegments, durationFor } from "../../src/plan/picker.js";

const pages = [
  { id: "dashboard", route: "/dashboard", title: "Dashboard", importance: 5, requires_auth: true },
  { id: "profile", route: "/profile", title: "Profile", importance: 1, requires_auth: true },
  { id: "settings", route: "/settings", title: "Settings", importance: 3, requires_auth: true },
  { id: "login", route: "/login", title: "Sign in", importance: 0, requires_auth: false }
];

describe("pickSegments", () => {
  it("defaults to top-N by importance when no selection given", () => {
    const segs = pickSegments({ pages, selected: [], defaultTopN: 2 }, "medium", "friendly");
    expect(segs.map(s => s.page_id)).toEqual(["dashboard", "settings"]);
  });

  it("respects user selection regardless of importance", () => {
    const segs = pickSegments({ pages, selected: ["login", "profile"] }, "low", "pro");
    expect(segs.map(s => s.page_id)).toEqual(["login", "profile"]);
  });

  it("assigns sequential ids in selection order", () => {
    const segs = pickSegments({ pages, selected: ["dashboard", "settings"] }, "medium", "friendly");
    expect(segs[0]?.id).toBe("s01_dashboard");
    expect(segs[1]?.id).toBe("s02_settings");
  });

  it("propagates depth and tone to each segment", () => {
    const segs = pickSegments({ pages, selected: ["dashboard"] }, "high", "documentary");
    expect(segs[0]?.depth).toBe("high");
    expect(segs[0]?.tone).toBe("documentary");
  });

  it("uses durationFor for target_duration_s", () => {
    const segs = pickSegments({ pages, selected: ["dashboard"] }, "medium", "friendly");
    expect(segs[0]?.target_duration_s).toBe(durationFor("medium"));
  });
});

describe("durationFor", () => {
  it("low → 30", () => expect(durationFor("low")).toBe(30));
  it("medium → 75", () => expect(durationFor("medium")).toBe(75));
  it("high → 180", () => expect(durationFor("high")).toBe(180));
});
