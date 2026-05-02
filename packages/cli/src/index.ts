import { Command } from "commander";
import { logger } from "./logger.js";

const program = new Command();

program
  .name("tutorialvid")
  .description("Turn vibe-coded web apps into tutorial videos")
  .version("0.0.1");

program
  .command("scan")
  .description("Reconcile code-graph + routes + crawl into a scan.json")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { scanCommand } = await import("./commands/scan.js");
    const code = await scanCommand({ cwd: opts.cwd });
    process.exit(code);
  });

program
  .command("plan")
  .description("Build a plan.json from the latest scan + user choices")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--select <ids>", "comma-separated page ids to include", (v: string) => v.split(",").map(s => s.trim()).filter(Boolean), [])
  .option("--top-n <n>", "default number of pages when no selection", (v: string) => parseInt(v, 10))
  .option("--no-markdown", "suppress markdown output")
  .action(async (opts) => {
    const { planCommand } = await import("./commands/plan.js");
    const code = await planCommand({
      cwd: opts.cwd,
      selected: opts.select,
      topN: opts.topN,
      printMarkdown: opts.markdown !== false
    });
    process.exit(code);
  });

program
  .command("script")
  .description("Prepare per-segment work files for skill-driven Claude Code subagent dispatch")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .option("--no-markdown", "suppress markdown output")
  .option("--standalone", "use Anthropic SDK directly (requires ANTHROPIC_API_KEY)")
  .action(async (opts) => {
    const { scriptCommand } = await import("./commands/script.js");
    const code = await scriptCommand({ cwd: opts.cwd, pluginRoot: opts.pluginRoot, printMarkdown: opts.markdown !== false, standalone: !!opts.standalone });
    process.exit(code);
  });

program
  .command("script-prepare")
  .description("Emit per-segment work files for skill subagent dispatch")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .action(async (opts) => {
    const { scriptPrepareCommand } = await import("./commands/script-prepare.js");
    const code = await scriptPrepareCommand({ cwd: opts.cwd, pluginRoot: opts.pluginRoot });
    process.exit(code);
  });

program
  .command("script-consume")
  .description("Read subagent result files + persist scene.json/txt/ssml")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--no-markdown", "suppress Gate 2 markdown")
  .action(async (opts) => {
    const { scriptConsumeCommand } = await import("./commands/script-consume.js");
    const code = await scriptConsumeCommand({ cwd: opts.cwd, printMarkdown: opts.markdown !== false });
    process.exit(code);
  });

program
  .command("tts")
  .description("Synthesise per-segment narration via Gemini TTS")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { ttsCommand } = await import("./commands/tts.js");
    const code = await ttsCommand({ cwd: opts.cwd });
    process.exit(code);
  });

program
  .command("record")
  .description("Record per-segment Playwright video + cursor track from scene.json")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--no-markdown", "suppress Gate 3 markdown output")
  .action(async (opts) => {
    const { recordCommand } = await import("./commands/record.js");
    const code = await recordCommand({ cwd: opts.cwd, printMarkdown: opts.markdown !== false });
    process.exit(code);
  });

program
  .command("compose")
  .description("Render per-segment Remotion compositions + stitch + watermark draft (Gate 4)")
  .option("--cwd <path>", "project root", process.cwd())
  .option("--plugin-root <path>", "override plugin package root")
  .option("--no-markdown", "suppress Gate 4 markdown")
  .action(async (opts) => {
    const { composeCommand } = await import("./commands/compose.js");
    const code = await composeCommand({
      cwd: opts.cwd,
      pluginRoot: opts.pluginRoot,
      printMarkdown: opts.markdown !== false,
    });
    process.exit(code);
  });

program
  .command("finalize")
  .description("Promote the HD stitch to final.mp4 + final.srt (no watermark)")
  .option("--cwd <path>", "project root", process.cwd())
  .action(async (opts) => {
    const { finalizeCommand } = await import("./commands/finalize.js");
    const code = await finalizeCommand({ cwd: opts.cwd });
    process.exit(code);
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, "CLI fatal error");
  process.exit(1);
});
