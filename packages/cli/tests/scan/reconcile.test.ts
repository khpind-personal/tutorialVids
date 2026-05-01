import { describe, it, expect } from "vitest";
import { reconcile } from "../../src/scan/reconcile.js";

const routes = [
  { path: "/login", element: "Login" },
  { path: "/dashboard", element: "Dashboard" },
  { path: "/profile", element: "Profile" }
];

const crawl = {
  pages: [
    { route: "/login", title: "Sign in", primary_actions: [{ selector: "[data-test=submit]", label: "Sign in", kind: "submit" as const }] },
    { route: "/dashboard", title: "Dashboard", primary_actions: [] },
    { route: "/profile", title: "Profile", primary_actions: [] }
  ],
  warnings: []
};

const graph = {
  nodes: [
    { id: "n1", label: "Login::default", file: "src/pages/Login.tsx", kind: "function" },
    { id: "n2", label: "Dashboard::default", file: "src/pages/Dashboard.tsx", kind: "function" },
    { id: "n3", label: "Profile::default", file: "src/pages/Profile.tsx", kind: "function" }
  ],
  links: [{ source: "n2", target: "n3" }],
  warnings: []
};

describe("reconcile", () => {
  it("merges all three sources into PageEntry array", () => {
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl, graph });
    expect(r.pages).toHaveLength(3);
    const dash = r.pages.find(p => p.route === "/dashboard")!;
    expect(dash.title).toBe("Dashboard");
    expect(dash.graph_node).toBe("n2");
  });

  it("flags route present in code but not crawled", () => {
    const orphan = [...routes, { path: "/legacy", element: "Legacy" }];
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes: orphan, crawl, graph });
    expect(r.warnings.some(w => w.code === "route-not-mounted")).toBe(true);
  });

  it("flags page crawled but not in router config", () => {
    const extraCrawl = { ...crawl, pages: [...crawl.pages, { route: "/admin", title: "Admin", primary_actions: [] }] };
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl: extraCrawl, graph });
    expect(r.warnings.some(w => w.code === "crawled-not-routed")).toBe(true);
  });

  it("computes importance from graph hub-score", () => {
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl, graph });
    const dash = r.pages.find(p => p.route === "/dashboard")!;
    const profile = r.pages.find(p => p.route === "/profile")!;
    expect(dash.importance).toBeGreaterThanOrEqual(profile.importance);
  });

  it("requires_auth=true when login redirect detected", () => {
    const authCrawl = { ...crawl, warnings: [{ code: "redirect-to-login", message: "/dashboard redirected to /login" }] };
    const r = reconcile({ framework: "react-router", baseUrl: "http://localhost:5173", routes, crawl: authCrawl, graph });
    expect(r.pages.find(p => p.route === "/dashboard")?.requires_auth).toBe(true);
  });
});
