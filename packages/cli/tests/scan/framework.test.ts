import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFramework } from "../../src/scan/framework.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-fw-")); });

function writePkg(deps: Record<string, string>) {
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: deps }));
}

describe("detectFramework", () => {
  it("detects react-router from react-router-dom dep", async () => {
    writePkg({ "react-router-dom": "^7.0.0" });
    expect(await detectFramework(root)).toBe("react-router");
  });
  it("detects next-app from next dep + app dir", async () => {
    writePkg({ "next": "^14.0.0" });
    mkdirSync(join(root, "app"));
    expect(await detectFramework(root)).toBe("next-app");
  });
  it("detects astro from astro dep", async () => {
    writePkg({ "astro": "^4.0.0" });
    expect(await detectFramework(root)).toBe("astro");
  });
  it("detects tanstack-router from @tanstack/react-router dep", async () => {
    writePkg({ "@tanstack/react-router": "^1.0.0" });
    expect(await detectFramework(root)).toBe("tanstack-router");
  });
  it("returns unknown when no recognized framework", async () => {
    writePkg({});
    expect(await detectFramework(root)).toBe("unknown");
  });
  it("uses framework_hint override when provided", async () => {
    writePkg({});
    expect(await detectFramework(root, "vite-router")).toBe("vite-router");
  });
});
