import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateMachine, type Stage } from "../../src/state/machine.js";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tv-state-")); });

describe("StateMachine", () => {
  it("starts empty when no state file exists", async () => {
    const sm = new StateMachine(root);
    const s = await sm.load();
    expect(s.last_completed_stage).toBeNull();
    expect(s.gates_passed).toEqual([]);
    expect(s.segments).toEqual({});
  });
  it("records stage completion", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.markStageComplete("scan");
    const s = await sm.load();
    expect(s.last_completed_stage).toBe("scan");
  });
  it("tracks per-segment status", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.markSegmentStage("s01", "scan", "ok");
    await sm.markSegmentStage("s01", "record", "failed", "selector timed out");
    const s = await sm.load();
    expect(s.segments.s01?.scan).toBe("ok");
    expect(s.segments.s01?.record).toBe("failed");
    expect(s.segments.s01?.last_error).toBe("selector timed out");
  });
  it("records gate pass exactly once", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await sm.passGate("plan");
    await sm.passGate("plan");
    const s = await sm.load();
    expect(s.gates_passed).toEqual(["plan"]);
  });
  it("rejects unknown stages", async () => {
    const sm = new StateMachine(root);
    await sm.load();
    await expect(sm.markStageComplete("nope" as Stage)).rejects.toThrow(/unknown stage/i);
  });
});
