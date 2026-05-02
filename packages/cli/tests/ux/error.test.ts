import { describe, it, expect } from "vitest";
import { formatError, renderError } from "../../src/ux/error.js";

describe("formatError", () => {
  it("recognises API-key errors", () => {
    const e = formatError(new Error("ANTHROPIC_API_KEY is not set"), "script");
    expect(e.what).toMatch(/ANTHROPIC_API_KEY/);
    expect(e.next).toMatch(/export ANTHROPIC_API_KEY/);
  });
  it("recognises missing-prior-artifact errors", () => {
    const e = formatError(new Error("no scan.json found in cache; run 'tutorialvid scan' first"), "plan");
    expect(e.next).toMatch(/run.*tutorialvid/);
  });
  it("recognises selector failures", () => {
    const e = formatError(new Error("selector [data-test=x] failed after 3 attempts"), "record");
    expect(e.what).toMatch(/selector/);
  });
  it("falls back to generic format with debug hint", () => {
    const e = formatError(new Error("weird"), "compose");
    expect(e.next).toMatch(/TV_LOG_LEVEL=debug/);
  });
});

describe("renderError", () => {
  it("renders the three-line surface with prefix", () => {
    const s = renderError({ what: "x", why: "y", next: "z" });
    expect(s).toMatch(/✖ x/);
    expect(s).toMatch(/why: y/);
    expect(s).toMatch(/next: z/);
  });
});
