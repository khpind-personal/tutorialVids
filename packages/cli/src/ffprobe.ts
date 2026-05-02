import { execa } from "execa";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

export async function probeDurationMs(audioPath: string): Promise<number> {
  const { stdout } = await execa(ffprobeInstaller.path, [
    "-v", "error", "-show_format", "-print_format", "json", audioPath
  ]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const sec = parseFloat(parsed.format?.duration ?? "0");
  return Math.round(sec * 1000);
}
