import { execa } from "execa";

export interface RunSeedInput {
  command: string;
  cwd: string;
  skipMarkerPath?: string;
}

export async function runSeed(input: RunSeedInput): Promise<void> {
  if (input.skipMarkerPath) {
    try {
      const { access } = await import("node:fs/promises");
      await access(input.skipMarkerPath);
      return;
    } catch {}
  }
  const [bin, ...args] = input.command.split(/\s+/);
  if (!bin) throw new Error("seed command empty");
  await execa(bin, args, { cwd: input.cwd, stdio: "inherit" });
  if (input.skipMarkerPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(input.skipMarkerPath, new Date().toISOString());
  }
}
