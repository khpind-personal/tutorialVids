import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReactRouterRoutes } from "../../../src/scan/routes/react-router.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-rr-")); });

function writeRouter(content: string) {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/router.tsx"), content);
}

describe("parseReactRouterRoutes", () => {
  it("extracts routes from createBrowserRouter array", async () => {
    writeRouter(`
      import { createBrowserRouter } from "react-router-dom";
      export const router = createBrowserRouter([
        { path: "/login", element: <Login /> },
        { path: "/dashboard", element: <Dashboard /> },
        { path: "/profile", element: <Profile /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes.map(r => r.path).sort()).toEqual(["/dashboard", "/login", "/profile"]);
  });

  it("ignores Navigate redirects", async () => {
    writeRouter(`
      export const router = createBrowserRouter([
        { path: "/", element: <Navigate to="/dashboard" /> },
        { path: "/dashboard", element: <Dashboard /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes.find(r => r.path === "/")).toBeUndefined();
    expect(routes.find(r => r.path === "/dashboard")).toBeDefined();
  });

  it("captures element name for each route", async () => {
    writeRouter(`
      export const router = createBrowserRouter([
        { path: "/x", element: <Foo /> }
      ]);
    `);
    const routes = await parseReactRouterRoutes(root);
    expect(routes[0]?.element).toBe("Foo");
  });

  it("returns empty array when no router file found", async () => {
    expect(await parseReactRouterRoutes(root)).toEqual([]);
  });
});
