import { describe, it, expect } from "vitest";
import { wordsToSrt, msToSrtTimestamp } from "../../src/compose/srt.js";

describe("msToSrtTimestamp", () => {
  it("formats ms as hh:mm:ss,ms", () => {
    expect(msToSrtTimestamp(0)).toBe("00:00:00,000");
    expect(msToSrtTimestamp(1234)).toBe("00:00:01,234");
    expect(msToSrtTimestamp(61_500)).toBe("00:01:01,500");
    expect(msToSrtTimestamp(3_661_999)).toBe("01:01:01,999");
  });
});

describe("wordsToSrt", () => {
  it("groups words into 5-word lines per cue", () => {
    const words = Array.from({ length: 12 }).map((_, i) => ({
      word: `w${i}`, start_ms: i * 500, end_ms: (i + 1) * 500
    }));
    const srt = wordsToSrt(words, 5);
    const cues = srt.split(/\n\n/).filter(Boolean);
    expect(cues.length).toBe(3);
    expect(cues[0]).toMatch(/^1\n00:00:00,000 --> 00:00:02,500/);
  });

  it("returns empty string for no words", () => {
    expect(wordsToSrt([], 5)).toBe("");
  });
});
