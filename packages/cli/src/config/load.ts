import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import { ConfigSchema, type Config } from "./schema.js";

export async function loadConfig(projectRoot: string): Promise<Config> {
  const path = join(projectRoot, ".tutorialvid", "config.json");
  try { await access(path); }
  catch { throw new Error(`config not found at ${path}`); }
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (err) { throw new Error(`config is not valid JSON: ${(err as Error).message}`); }
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) throw new Error(`invalid config: ${result.error.message}`);
  return result.data;
}
