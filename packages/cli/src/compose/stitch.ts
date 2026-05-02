import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { concatSegments, duckMixMusic } from "./ffmpeg.js";

export interface StitchInput {
  segmentMp4s: string[];
  introTemplatePath: string;
  outroTemplatePath: string;
  musicPath: string;
  musicVolume: number;
  appName: string;
  outroCta: string | undefined;
  workDir: string;
  finalOut: string;
  resolution: { width: number; height: number };
}

interface IntroSpec {
  name: string;
  duration_s: number;
  background: string;
  title_text: string;
  title_color: string;
  title_font_size: number;
}
interface OutroSpec extends IntroSpec {
  cta_text: string;
  cta_color: string;
  cta_font_size: number;
}

function run(chain: ReturnType<typeof ffmpeg>): Promise<void> {
  return new Promise((resolve, reject) => {
    chain.on("end", () => resolve()).on("error", (e: Error) => reject(e)).run();
  });
}

async function renderTitleCard(opts: {
  text: string; subtext?: string; bg: string; fg: string; subFg?: string;
  durationS: number; fontSize: number; subFontSize?: number;
  out: string; resolution: { width: number; height: number };
}): Promise<void> {
  const chain = ffmpeg();
  chain.input(`color=c=${opts.bg.replace("#", "0x")}:s=${opts.resolution.width}x${opts.resolution.height}:d=${opts.durationS}`);
  chain.inputOptions(["-f", "lavfi"]);
  const filters: { filter: string; options: Record<string, string | number> }[] = [
    { filter: "drawtext", options: { text: opts.text, fontsize: opts.fontSize, fontcolor: opts.fg, x: "(w-tw)/2", y: "(h-th)/2 - 50" } }
  ];
  if (opts.subtext) {
    filters.push({ filter: "drawtext", options: { text: opts.subtext, fontsize: opts.subFontSize ?? 32, fontcolor: opts.subFg ?? opts.fg, x: "(w-tw)/2", y: "(h-th)/2 + 50" } });
  }
  chain.videoFilters(filters);
  chain.outputOptions(["-pix_fmt", "yuv420p", "-t", String(opts.durationS)]);
  chain.output(opts.out);
  await run(chain);
}

export async function stitchFinal(input: StitchInput): Promise<string> {
  await mkdir(input.workDir, { recursive: true });
  const intro = JSON.parse(await readFile(input.introTemplatePath, "utf8")) as IntroSpec;
  const outro = JSON.parse(await readFile(input.outroTemplatePath, "utf8")) as OutroSpec;

  const introMp4 = join(input.workDir, "intro.mp4");
  const outroMp4 = join(input.workDir, "outro.mp4");
  await renderTitleCard({
    text: intro.title_text.replace("{{app.name}}", input.appName),
    bg: intro.background, fg: intro.title_color, durationS: intro.duration_s, fontSize: intro.title_font_size,
    out: introMp4, resolution: input.resolution
  });
  await renderTitleCard({
    text: outro.title_text,
    subtext: outro.cta_text.replace("{{compose.outro_cta}}", input.outroCta ?? "example.com"),
    bg: outro.background, fg: outro.title_color, subFg: outro.cta_color,
    durationS: outro.duration_s, fontSize: outro.title_font_size, subFontSize: outro.cta_font_size,
    out: outroMp4, resolution: input.resolution
  });

  const concatOut = join(input.workDir, "concat.mp4");
  await concatSegments([introMp4, ...input.segmentMp4s, outroMp4], concatOut);

  await duckMixMusic({ videoIn: concatOut, musicIn: input.musicPath, out: input.finalOut, musicVolume: input.musicVolume });

  return input.finalOut;
}
