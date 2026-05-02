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

export async function applyWatermark(inPath: string, outPath: string, text: string): Promise<void> {
  const chain = ffmpeg(inPath);
  chain.videoFilters([{
    filter: "drawtext",
    options: { text, fontsize: 36, fontcolor: "white@0.7", x: "w-tw-20", y: "20", box: 1, boxcolor: "black@0.4", boxborderw: 8 }
  }]);
  chain.output(outPath);
  await run(chain);
}

export interface DuckMixInput { videoIn: string; musicIn: string; out: string; musicVolume: number; }

export async function duckMixMusic(input: DuckMixInput): Promise<void> {
  const chain = ffmpeg();
  chain.input(input.videoIn);
  chain.input(input.musicIn);
  chain.complexFilter([
    `[1:a]volume=${input.musicVolume}[music_low]`,
    `[0:a][music_low]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[mix]`
  ], ["mix"]);
  chain.outputOptions(["-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-shortest"]);
  chain.output(input.out);
  await run(chain);
}

export async function downscaleTo480p(inPath: string, outPath: string): Promise<void> {
  const chain = ffmpeg(inPath);
  chain.videoFilters([{ filter: "scale", options: { w: 854, h: 480 } }]);
  chain.output(outPath);
  await run(chain);
}
