import { join } from "node:path";
import { readFile, access } from "node:fs/promises";
import matter from "gray-matter";
import type { AgentPrompt } from "./types.js";

export async function loadAgentPrompt(pluginRoot: string, agentName: string): Promise<AgentPrompt> {
  const path = join(pluginRoot, "agents", `${agentName}.md`);
  try { await access(path); }
  catch { throw new Error(`agent prompt not found at ${path}`); }
  const raw = await readFile(path, "utf8");
  const { data, content } = matter(raw);
  if (!data.name || typeof data.name !== "string") {
    throw new Error(`agent prompt at ${path} missing 'name' in frontmatter`);
  }
  if (!data.description || typeof data.description !== "string") {
    throw new Error(`agent prompt at ${path} missing 'description' in frontmatter`);
  }
  return {
    name: data.name,
    description: data.description,
    ...(typeof data.model === "string" ? { model: data.model } : {}),
    system: content.trim()
  };
}
