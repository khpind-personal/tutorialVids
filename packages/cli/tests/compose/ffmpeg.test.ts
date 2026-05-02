import { describe, it, expect, vi, beforeEach } from "vitest";
import { concatSegments, applyWatermark, duckMixMusic } from "../../src/compose/ffmpeg.js";

const runMock = vi.fn();
const inputMock = vi.fn();
const outputMock = vi.fn();
const onMock = vi.fn();
const audioFiltersMock = vi.fn();
const videoFiltersMock = vi.fn();
const complexFilterMock = vi.fn();
const outputOptionsMock = vi.fn();

const fakeChain: Record<string, (...args: unknown[]) => unknown> = {};
const chainObj = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === "run") return runMock;
    if (prop === "on") return (...args: unknown[]) => { onMock(...args); return chainObj; };
    return (...args: unknown[]) => { (fakeChain[String(prop)] ?? ((..._args: unknown[]) => undefined))(...args); return chainObj; };
  }
});

vi.mock("fluent-ffmpeg", () => {
  const fn = vi.fn(() => chainObj);
  (fn as unknown as { setFfmpegPath: (p: string) => void }).setFfmpegPath = vi.fn();
  return { default: fn };
});

beforeEach(() => {
  runMock.mockReset(); inputMock.mockReset(); outputMock.mockReset(); onMock.mockReset();
  fakeChain.input = inputMock; fakeChain.output = outputMock;
  fakeChain.audioFilters = audioFiltersMock; fakeChain.videoFilters = videoFiltersMock;
  fakeChain.complexFilter = complexFilterMock; fakeChain.outputOptions = outputOptionsMock;
  onMock.mockImplementation(((event: string, cb: () => void) => {
    if (event === "end") setTimeout(cb, 0);
  }) as unknown as typeof onMock);
  runMock.mockImplementation(() => undefined);
});

describe("concatSegments", () => {
  it("invokes ffmpeg.concat with each input + output", async () => {
    await concatSegments(["a.mp4", "b.mp4"], "out.mp4");
    expect(inputMock).toHaveBeenCalledTimes(2);
    expect(outputMock).toHaveBeenCalledWith("out.mp4");
  });
});

describe("applyWatermark", () => {
  it("uses drawtext filter with the supplied text", async () => {
    await applyWatermark("in.mp4", "out.mp4", "DRAFT");
    expect(videoFiltersMock).toHaveBeenCalled();
    const call = videoFiltersMock.mock.calls[0]?.[0];
    expect(JSON.stringify(call)).toMatch(/DRAFT/);
  });
});

describe("duckMixMusic", () => {
  it("uses sidechaincompress filter to duck music under voice", async () => {
    await duckMixMusic({ videoIn: "v.mp4", musicIn: "m.mp3", out: "out.mp4", musicVolume: 0.15 });
    expect(complexFilterMock).toHaveBeenCalled();
    expect(outputMock).toHaveBeenCalledWith("out.mp4");
  });
});
