import { describe, it, expect } from "vitest";
import { formatPlanMarkdown } from "../../src/plan/format.js";
import type { Plan } from "../../src/plan/types.js";

const plan: Plan = {
  framework: "react-router",
  base_url: "http://localhost:5173",
  depth: "medium",
  tone: "friendly",
  language: "en-US",
  created_at: "2026-05-02T00:00:00Z",
  segments: [
    { id: "s01_dashboard", page_id: "dashboard", page_route: "/dashboard", page_title: "Dashboard",
      depth: "medium", tone: "friendly", target_duration_s: 75, importance: 5, requires_auth: true },
    { id: "s02_profile", page_id: "profile", page_route: "/profile", page_title: "Profile",
      depth: "medium", tone: "friendly", target_duration_s: 75, importance: 1, requires_auth: true }
  ]
};

describe("formatPlanMarkdown", () => {
  it("includes a header line summarizing depth + tone + segment count", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/2 segments/);
    expect(md).toMatch(/medium/);
    expect(md).toMatch(/friendly/);
  });

  it("renders a markdown table with one row per segment", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/\| s01_dashboard \|.*\| Dashboard \|/);
    expect(md).toMatch(/\| s02_profile \|.*\| Profile \|/);
  });

  it("computes total estimated duration in mm:ss format", () => {
    const md = formatPlanMarkdown(plan);
    expect(md).toMatch(/total.*2:30/i);
  });
});
