import { describe, it, expect } from "vitest";
import { detectAuthExpiry } from "../../src/record/recovery.js";

describe("detectAuthExpiry", () => {
  it("detects redirect to login url", () => {
    expect(detectAuthExpiry({ status: 302, finalUrl: "http://x/login" }, "/login")).toBe(true);
    expect(detectAuthExpiry({ status: 200, finalUrl: "http://x/login" }, "/login")).toBe(true);
  });

  it("detects 401 and 403 statuses", () => {
    expect(detectAuthExpiry({ status: 401, finalUrl: "http://x/dashboard" }, "/login")).toBe(true);
    expect(detectAuthExpiry({ status: 403, finalUrl: "http://x/dashboard" }, "/login")).toBe(true);
  });

  it("returns false for normal responses", () => {
    expect(detectAuthExpiry({ status: 200, finalUrl: "http://x/dashboard" }, "/login")).toBe(false);
  });
});
