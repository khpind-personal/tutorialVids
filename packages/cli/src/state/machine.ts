import { join } from "node:path";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";

export const STAGES = ["discovery", "scan", "plan", "script", "tts", "record", "compose", "final"] as const;
export type Stage = typeof STAGES[number];

export const GATES = ["discovery", "plan", "script", "recording", "final-draft"] as const;
export type Gate = typeof GATES[number];

export type SegmentStageStatus = "pending" | "ok" | "failed" | "skipped";

export interface State {
  last_completed_stage: Stage | null;
  last_command: string | null;
  started_at: string;
  gates_passed: Gate[];
  segments: Record<string, Partial<Record<Stage, SegmentStageStatus>> & { last_error?: string }>;
}

const EMPTY: State = {
  last_completed_stage: null,
  last_command: null,
  started_at: new Date().toISOString(),
  gates_passed: [],
  segments: {}
};

export class StateMachine {
  private statePath: string;
  private cached: State | null = null;
  constructor(projectRoot: string) {
    this.statePath = join(projectRoot, ".tutorialvid", "state.json");
  }
  async load(): Promise<State> {
    try {
      await access(this.statePath);
      this.cached = JSON.parse(await readFile(this.statePath, "utf8")) as State;
    } catch {
      this.cached = { ...EMPTY, started_at: new Date().toISOString() };
    }
    return this.cached;
  }
  private async save(): Promise<void> {
    if (!this.cached) throw new Error("state not loaded");
    await mkdir(join(this.statePath, ".."), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.cached, null, 2), "utf8");
  }
  async markStageComplete(stage: Stage): Promise<void> {
    if (!STAGES.includes(stage)) throw new Error(`unknown stage: ${stage}`);
    const s = await this.load();
    s.last_completed_stage = stage;
    await this.save();
  }
  async markSegmentStage(segmentId: string, stage: Stage, status: SegmentStageStatus, lastError?: string): Promise<void> {
    if (!STAGES.includes(stage)) throw new Error(`unknown stage: ${stage}`);
    const s = await this.load();
    const seg = s.segments[segmentId] ?? {};
    seg[stage] = status;
    if (lastError) seg.last_error = lastError;
    s.segments[segmentId] = seg;
    await this.save();
  }
  async passGate(gate: Gate): Promise<void> {
    const s = await this.load();
    if (!s.gates_passed.includes(gate)) s.gates_passed.push(gate);
    await this.save();
  }
  async recordCommand(name: string): Promise<void> {
    const s = await this.load();
    s.last_command = name;
    await this.save();
  }
}
