import { describe, it, expect, vi, beforeEach } from "vitest";
import { probeDurationMs } from "../src/ffprobe.js";

const execaMock = vi.fn();
vi.mock("execa", () => ({ execa: (...args: unknown[]) => execaMock(...args) }));

beforeEach(() => execaMock.mockReset());

describe("probeDurationMs", () => {
  it("parses ffprobe JSON output and returns ms", async () => {
    execaMock.mockResolvedValueOnce({ stdout: JSON.stringify({ format: { duration: "12.345" } }) });
    expect(await probeDurationMs("/tmp/x.mp3")).toBe(12345);
  });
  it("returns 0 when ffprobe output has no duration", async () => {
    execaMock.mockResolvedValueOnce({ stdout: JSON.stringify({ format: {} }) });
    expect(await probeDurationMs("/tmp/x.mp3")).toBe(0);
  });
});
