import { access, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { cachePaths } from "../cache/paths.js";
import { StateMachine, STAGES, type Stage } from "../state/machine.js";

export interface StatusCommandOpts { cwd: string; }

interface StageReport {
  stage: Stage;
  status: "done" | "partial" | "missing" | "skipped";
  hint: string;
  next_command?: string;
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function dirHasFiles(p: string): Promise<boolean> {
  try {
    const items = await readdir(p);
    return items.length > 0;
  } catch { return false; }
}

async function nonEmptyJsonInDir(p: string): Promise<boolean> {
  try {
    const items = await readdir(p);
    for (const f of items) {
      if (f.endsWith(".json")) {
        const s = await stat(join(p, f));
        if (s.size > 10) return true;
      }
    }
    return false;
  } catch { return false; }
}

async function reportStages(projectRoot: string): Promise<StageReport[]> {
  const paths = cachePaths(projectRoot);
  const C = paths.cache;
  const out: StageReport[] = [];

  out.push({
    stage: "discovery",
    status: (await nonEmptyJsonInDir(join(C, "discovery"))) ? "done" : "missing",
    hint: "Phase 0 — per-role accessibility crawl + context corpus.",
    next_command: "tutorialvid discovery --cwd ."
  });

  out.push({
    stage: "scan",
    status: (await nonEmptyJsonInDir(join(C, "scan"))) ? "done" : "missing",
    hint: "Routes + framework + crawl reconciled into scan.json.",
    next_command: "tutorialvid scan --cwd ."
  });

  out.push({
    stage: "plan",
    status: (await nonEmptyJsonInDir(join(C, "plan"))) ? "done" : "missing",
    hint: "Pick segments. Gate 1 — review the plan markdown.",
    next_command: "tutorialvid plan --cwd ."
  });

  const scriptDir = join(C, "script");
  const scriptDone = await (async () => {
    if (!(await exists(scriptDir))) return false;
    const segs = (await readdir(scriptDir)).filter((s) => !s.startsWith("_"));
    if (segs.length === 0) return false;
    for (const s of segs) {
      const files = await readdir(join(scriptDir, s)).catch(() => [] as string[]);
      if (!files.some((f) => f.endsWith(".scene.json"))) return false;
    }
    return true;
  })();
  const workCount = await (async () => {
    try { return (await readdir(join(scriptDir, "_work"))).filter((f) => f.endsWith(".json")).length; } catch { return 0; }
  })();
  const resultCount = await (async () => {
    try { return (await readdir(join(scriptDir, "_result"))).filter((f) => f.endsWith(".json")).length; } catch { return 0; }
  })();
  const scriptStatus: StageReport["status"] = scriptDone ? "done" : workCount > 0 && resultCount === 0 ? "partial" : "missing";
  const scriptHint = scriptDone
    ? "Scenes consumed."
    : workCount > 0 && resultCount === 0
      ? `Work files emitted (${workCount}). Skill must dispatch tutorialvid-segment-author per file → save to _result/.`
      : "Run script-prepare, then dispatch the segment-author subagent for each work file, then script-consume.";
  const scriptCmd = scriptDone
    ? undefined
    : workCount > 0 && resultCount === 0
      ? "tutorialvid script-consume --cwd . (after subagent dispatches)"
      : "tutorialvid script-prepare --cwd .";
  out.push({ stage: "script", status: scriptStatus, hint: scriptHint, ...(scriptCmd ? { next_command: scriptCmd } : {}) });

  const ttsHasMp3 = await (async () => {
    if (!(await exists(scriptDir))) return false;
    const segs = (await readdir(scriptDir)).filter((s) => !s.startsWith("_"));
    if (segs.length === 0) return false;
    for (const s of segs) {
      const files = await readdir(join(scriptDir, s)).catch(() => [] as string[]);
      if (!files.some((f) => f.endsWith(".mp3"))) return false;
    }
    return true;
  })();
  out.push({
    stage: "tts",
    status: ttsHasMp3 ? "done" : "missing",
    hint: "Beat-driven TTS. Needs GEMINI_API_KEY.",
    next_command: "tutorialvid tts --cwd ."
  });

  const paced = await (async () => {
    if (!(await exists(scriptDir))) return false;
    const segs = (await readdir(scriptDir)).filter((s) => !s.startsWith("_"));
    for (const s of segs) {
      const timing = join(scriptDir, s, "tts.timing.json");
      if (await exists(timing)) {
        const raw = await import("node:fs/promises").then((fs) => fs.readFile(timing, "utf8")).catch(() => "");
        if (raw && raw.includes('"action_t_ms"')) return true;
      }
    }
    return false;
  })();
  out.push({
    stage: "pace",
    status: paced ? "done" : ttsHasMp3 ? "missing" : "missing",
    hint: "Re-grid scene t_ms from measured TTS durations + breath gaps.",
    next_command: "tutorialvid pace --cwd ."
  });

  const recordDone = await (async () => {
    const recordDir = join(C, "record");
    if (!(await exists(recordDir))) return false;
    const segs = await readdir(recordDir).catch(() => [] as string[]);
    for (const s of segs) {
      const files = await readdir(join(recordDir, s)).catch(() => [] as string[]);
      if (!files.some((f) => f.endsWith(".webm") || f.endsWith(".mp4"))) return false;
    }
    return segs.length > 0;
  })();
  out.push({
    stage: "record",
    status: recordDone ? "done" : "missing",
    hint: "Playwright capture per segment, with live bbox capture.",
    next_command: "tutorialvid record --cwd ."
  });

  const composeDone = await dirHasFiles(join(C, "final"));
  out.push({
    stage: "compose",
    status: composeDone ? "done" : "missing",
    hint: "Per-role drafts at cache/final/draft.<role>.mp4. Gate 4.",
    next_command: "tutorialvid compose --cwd ."
  });

  out.push({
    stage: "verify",
    status: composeDone ? "missing" : "skipped",
    hint: "Gate 5 — A/V/SRT sync QC. Mandatory before finalize.",
    next_command: "tutorialvid verify --cwd ."
  });

  out.push({
    stage: "final",
    status: "missing",
    hint: "Promote HD stitch to final.<role>.mp4 (no watermark).",
    next_command: "tutorialvid finalize --cwd ."
  });

  return out;
}

function statusGlyph(s: StageReport["status"]): string {
  if (s === "done") return "✓";
  if (s === "partial") return "◐";
  if (s === "skipped") return "◯";
  return "·";
}

export async function statusCommand(opts: StatusCommandOpts): Promise<number> {
  const sm = new StateMachine(opts.cwd);
  const state = await sm.load();

  const reports = await reportStages(opts.cwd);
  const lines: string[] = [];
  lines.push("# TutorialVid Status");
  lines.push("");
  lines.push(`Project: \`${opts.cwd}\``);
  if (state.last_command) lines.push(`Last command: \`${state.last_command}\``);
  if (state.last_completed_stage) lines.push(`Last completed stage: **${state.last_completed_stage}**`);
  lines.push("");
  lines.push("| | Stage | State | Hint |");
  lines.push("|---|-------|-------|------|");
  for (const r of reports) {
    lines.push(`| ${statusGlyph(r.status)} | ${r.stage} | ${r.status} | ${r.hint} |`);
  }

  // First non-done stage = next step
  const next = reports.find((r) => r.status !== "done" && r.status !== "skipped");
  if (next && next.next_command) {
    lines.push("");
    lines.push("## Next");
    lines.push("");
    lines.push("```");
    lines.push(next.next_command);
    lines.push("```");
  } else {
    lines.push("");
    lines.push("All stages complete. Run `tutorialvid finalize` to ship the un-watermarked HD output.");
  }

  // Env / config quick check
  const issues: string[] = [];
  if (!process.env["GEMINI_API_KEY"]) issues.push("GEMINI_API_KEY not set in shell — `tts` will fail until you `export GEMINI_API_KEY=...`");
  if (issues.length > 0) {
    lines.push("");
    lines.push("## Environment");
    for (const i of issues) lines.push(`- ⚠ ${i}`);
  }

  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}
