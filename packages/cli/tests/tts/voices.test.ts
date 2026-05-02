import { describe, it, expect } from "vitest";
import { resolveVoice } from "../../src/tts/voices.js";

const cfgVoices = { friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" };
const cfgSpeeds = { friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 };

describe("resolveVoice", () => {
  it("returns voice + speed for each tone", () => {
    expect(resolveVoice("friendly", cfgVoices, cfgSpeeds)).toEqual({ voice: "Aoede", speed: 1.0 });
    expect(resolveVoice("hype", cfgVoices, cfgSpeeds)).toEqual({ voice: "Fenrir", speed: 1.10 });
    expect(resolveVoice("documentary", cfgVoices, cfgSpeeds)).toEqual({ voice: "Kore", speed: 0.95 });
  });

  it("works with custom voice override in config", () => {
    const custom = { ...cfgVoices, friendly: "Custom-X" };
    expect(resolveVoice("friendly", custom, cfgSpeeds)).toEqual({ voice: "Custom-X", speed: 1.0 });
  });
});
