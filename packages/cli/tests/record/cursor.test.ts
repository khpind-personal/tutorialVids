import { describe, it, expect } from "vitest";
import { CursorRecorder } from "../../src/record/cursor.js";

describe("CursorRecorder", () => {
  it("records mouse events with monotonic timestamps", () => {
    const r = new CursorRecorder();
    r.start();
    r.note("move", 10, 20);
    r.note("down", 10, 20);
    r.note("up", 10, 20);
    const track = r.stop();
    expect(track.events).toHaveLength(3);
    expect(track.events[0]?.event).toBe("move");
    expect(track.events[2]?.t_ms).toBeGreaterThanOrEqual(track.events[0]?.t_ms ?? 0);
  });

  it("filters duplicate move events at the same coordinate", () => {
    const r = new CursorRecorder();
    r.start();
    r.note("move", 10, 20);
    r.note("move", 10, 20);
    r.note("move", 11, 20);
    const track = r.stop();
    expect(track.events).toHaveLength(2);
  });
});
