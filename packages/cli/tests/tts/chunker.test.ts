import { describe, it, expect } from "vitest";
import { chunkSsml } from "../../src/tts/chunker.js";

describe("chunkSsml", () => {
  it("returns one chunk when SSML fits below limit", () => {
    const chunks = chunkSsml(`<speak>Hello world.</speak>`, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("Hello world.");
  });

  it("splits at <break> tags when over the limit", () => {
    const ssml = `<speak>First sentence here. <break time='200ms'/>Second sentence here. <break time='200ms'/>Third sentence here.</speak>`;
    const chunks = chunkSsml(ssml, 35);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.ssml.startsWith("<speak>") && c.ssml.endsWith("</speak>"))).toBe(true);
  });

  it("splits at sentence boundaries when no break tags exist", () => {
    const ssml = `<speak>Sentence one. Sentence two. Sentence three.</speak>`;
    const chunks = chunkSsml(ssml, 20);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("indexes chunks sequentially from 0", () => {
    const chunks = chunkSsml(`<speak>A. B. C. D.</speak>`, 5);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("strips ssml tags for the text field", () => {
    const chunks = chunkSsml(`<speak>Click <emphasis level='strong'>here</emphasis>.</speak>`, 1000);
    expect(chunks[0]?.text).toBe("Click here.");
  });
});
