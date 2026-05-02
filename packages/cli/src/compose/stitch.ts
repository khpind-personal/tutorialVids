import { mkdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
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

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(here, "../../src/compose-entry.tsx");
let cachedBundle: string | null = null;

async function ensureBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  cachedBundle = await bundle({ entryPoint: ENTRY });
  return cachedBundle;
}

async function renderIntro(opts: { title: string; bg: string; fg: string; fontSize: number; durationS: number; out: string; }): Promise<void> {
  const serveUrl = await ensureBundle();
  const inputProps = { title: opts.title, background: opts.bg, titleColor: opts.fg, fontSize: opts.fontSize };
  const composition = await selectComposition({ serveUrl, id: "Intro", inputProps: inputProps as unknown as Record<string, unknown> });
  await renderMedia({
    composition: { ...composition, durationInFrames: Math.round(opts.durationS * composition.fps) },
    serveUrl, codec: "h264", outputLocation: opts.out,
    inputProps: inputProps as unknown as Record<string, unknown>
  });
}

async function renderOutro(opts: { title: string; cta: string; bg: string; fg: string; ctaFg: string; titleFontSize: number; ctaFontSize: number; durationS: number; out: string; }): Promise<void> {
  const serveUrl = await ensureBundle();
  const inputProps = { title: opts.title, cta: opts.cta, background: opts.bg, titleColor: opts.fg, ctaColor: opts.ctaFg, titleFontSize: opts.titleFontSize, ctaFontSize: opts.ctaFontSize };
  const composition = await selectComposition({ serveUrl, id: "Outro", inputProps: inputProps as unknown as Record<string, unknown> });
  await renderMedia({
    composition: { ...composition, durationInFrames: Math.round(opts.durationS * composition.fps) },
    serveUrl, codec: "h264", outputLocation: opts.out,
    inputProps: inputProps as unknown as Record<string, unknown>
  });
}

export async function stitchFinal(input: StitchInput): Promise<string> {
  await mkdir(input.workDir, { recursive: true });
  const intro = JSON.parse(await readFile(input.introTemplatePath, "utf8")) as IntroSpec;
  const outro = JSON.parse(await readFile(input.outroTemplatePath, "utf8")) as OutroSpec;

  const introMp4 = join(input.workDir, "intro.mp4");
  const outroMp4 = join(input.workDir, "outro.mp4");
  await renderIntro({
    title: intro.title_text.replace("{{app.name}}", input.appName),
    bg: intro.background, fg: intro.title_color, fontSize: intro.title_font_size,
    durationS: intro.duration_s, out: introMp4
  });
  await renderOutro({
    title: outro.title_text,
    cta: outro.cta_text.replace("{{compose.outro_cta}}", input.outroCta ?? "example.com"),
    bg: outro.background, fg: outro.title_color, ctaFg: outro.cta_color,
    titleFontSize: outro.title_font_size, ctaFontSize: outro.cta_font_size,
    durationS: outro.duration_s, out: outroMp4
  });

  const concatOut = join(input.workDir, "concat.mp4");
  await concatSegments([introMp4, ...input.segmentMp4s, outroMp4], concatOut);

  await duckMixMusic({ videoIn: concatOut, musicIn: input.musicPath, out: input.finalOut, musicVolume: input.musicVolume });

  return input.finalOut;
}
