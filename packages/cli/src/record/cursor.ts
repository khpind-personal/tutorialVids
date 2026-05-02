import type { CursorEvent, CursorTrack } from "./types.js";

export class CursorRecorder {
  private startedAt = 0;
  private events: CursorEvent[] = [];

  start(): void { this.startedAt = Date.now(); this.events = []; }

  note(event: CursorEvent["event"], x: number, y: number): void {
    if (event === "move") {
      const last = this.events[this.events.length - 1];
      if (last && last.event === "move" && last.x === x && last.y === y) return;
    }
    this.events.push({ t_ms: Date.now() - this.startedAt, x, y, event });
  }

  stop(): CursorTrack { return { events: this.events.slice() }; }
}
