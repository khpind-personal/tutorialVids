import { describe, it, expect } from "vitest";
import { hashInputs } from "../../src/cache/hash.js";

describe("hashInputs", () => {
  it("returns a 16-char hex string", () => {
    expect(hashInputs({ a: 1, b: "x" })).toMatch(/^[0-9a-f]{16}$/);
  });
  it("is deterministic for same inputs", () => {
    expect(hashInputs({ a: 1, b: 2 })).toBe(hashInputs({ a: 1, b: 2 }));
  });
  it("is order-independent for object keys", () => {
    expect(hashInputs({ a: 1, b: 2 })).toBe(hashInputs({ b: 2, a: 1 }));
  });
  it("differs on different inputs", () => {
    expect(hashInputs({ a: 1 })).not.toBe(hashInputs({ a: 2 }));
  });
  it("handles nested objects deterministically", () => {
    expect(hashInputs({ a: { x: 1, y: 2 } })).toBe(hashInputs({ a: { y: 2, x: 1 } }));
  });
});
