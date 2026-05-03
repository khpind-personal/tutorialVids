import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

(ffmpeg as unknown as { setFfmpegPath: (p: string) => void }).setFfmpegPath(ffmpegInstaller.path);

function run(chain: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    chain.on("end", () => resolve()).on("error", (e: Error) => reject(e)).run();
  });
}

export async function concatSegments(inputs: string[], out: string): Promise<void> {
  const chain = ffmpeg();
  for (const i of inputs) chain.input(i);
  chain.outputOptions(["-filter_complex", `concat=n=${inputs.length}:v=1:a=1`]);
  chain.output(out);
  await run(chain);
}

async function findFontFile(): Promise<string | null> {
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arial.ttf"
  ];
  const { access } = await import("node:fs/promises");
  for (const c of candidates) {
    try { await access(c); return c; } catch {}
  }
  return null;
}

export async function applyWatermark(inPath: string, outPath: string, text: string): Promise<void> {
  const fontfile = await findFontFile();
  if (!fontfile) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(inPath, outPath);
    return;
  }
  const chain = ffmpeg(inPath);
  chain.videoFilters([{
    filter: "drawtext",
    options: { fontfile, text, fontsize: 36, fontcolor: "white@0.7", x: "w-tw-20", y: "20", box: 1, boxcolor: "black@0.4", boxborderw: 8 }
  }]);
  chain.output(outPath);
  await run(chain);
}

export interface DuckMixInput { videoIn: string; musicIn: string; out: string; musicVolume: number; }

async function probeDurationS(path: string): Promise<number> {
  return new Promise((resolve) => {
    (ffmpeg as unknown as { ffprobe: (p: string, cb: (err: Error | null, data: { format?: { duration?: number } }) => void) => void }).ffprobe(path, (err, data) => {
      if (err || !data?.format?.duration) { resolve(0); return; }
      resolve(data.format.duration);
    });
  });
}

const MIN_USABLE_MUSIC_S = 10;

export async function duckMixMusic(input: DuckMixInput): Promise<void> {
  const musicDur = await probeDurationS(input.musicIn);
  if (musicDur < MIN_USABLE_MUSIC_S) {
    // Music is a placeholder (~1s silent CC0 stub). Skip the mix; copy video+narration straight through.
    const chain = ffmpeg(input.videoIn);
    chain.outputOptions(["-c", "copy"]);
    chain.output(input.out);
    await run(chain);
    return;
  }
  // Loop the music to cover the full video duration, lower its volume, mix with narration.
  // Plain amix (no ducking) — sidechaincompress was unreliable when music was shorter than video.
  const chain = ffmpeg();
  chain.input(input.videoIn);
  chain.input(input.musicIn).inputOptions(["-stream_loop", "-1"]);
  chain.complexFilter([
    `[1:a]volume=${input.musicVolume}[music_low]`,
    `[0:a][music_low]amix=inputs=2:duration=first:dropout_transition=0[mix]`
  ], ["mix"]);
  chain.outputOptions(["-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-shortest"]);
  chain.output(input.out);
  await run(chain);
}

export async function downscaleTo(inPath: string, outPath: string, w: number, h: number): Promise<void> {
  const chain = ffmpeg(inPath);
  chain.videoFilters([{ filter: "scale", options: { w, h } }]);
  chain.output(outPath);
  await run(chain);
}

export async function downscaleTo480p(inPath: string, outPath: string): Promise<void> {
  await downscaleTo(inPath, outPath, 854, 480);
}
