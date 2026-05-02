import { describe, it, expect } from "vitest";
import { send } from "../../src/ux/telemetry.js";

describe("telemetry.send", () => {
  it("does nothing when disabled", async () => {
    await expect(send(false, { stage: "scan", duration_ms: 100 })).resolves.toBeUndefined();
  });
  it("logs event when enabled", async () => {
    await expect(send(true, { stage: "scan", duration_ms: 100, segment_count: 3 })).resolves.toBeUndefined();
  });
});
