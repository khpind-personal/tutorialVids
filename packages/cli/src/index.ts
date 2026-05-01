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

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, "CLI fatal error");
  process.exit(1);
});
