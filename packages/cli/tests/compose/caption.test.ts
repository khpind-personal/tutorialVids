import { describe, it, expect } from "vitest";
import { activeWordAt } from "../../src/compose/caption.js";

const words = [
  { word: "Hello", start_ms: 0, end_ms: 500 },
  { word: "world", start_ms: 500, end_ms: 1100 },
  { word: "now", start_ms: 1100, end_ms: 1600 }
];

describe("activeWordAt", () => {
  it("returns the word whose interval contains t_ms", () => {
    expect(activeWordAt(words, 0)?.word).toBe("Hello");
    expect(activeWordAt(words, 250)?.word).toBe("Hello");
    expect(activeWordAt(words, 600)?.word).toBe("world");
    expect(activeWordAt(words, 1500)?.word).toBe("now");
  });
  it("returns null after the last word", () => {
    expect(activeWordAt(words, 2000)).toBeNull();
  });
  it("returns null before the first word", () => {
    expect(activeWordAt(words, -10)).toBeNull();
  });
});
