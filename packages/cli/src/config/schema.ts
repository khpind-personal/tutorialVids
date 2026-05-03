import { z } from "zod";

export const ConfigSchema = z.object({
  version: z.literal(1),
  app: z.object({
    name: z.string().min(1),
    dev_url: z.string().url(),
    start_server: z.boolean().default(false),
    framework_hint: z.string().optional()
  }),
  auth: z.object({
    mode: z.literal("waterfall"),
    credentials: z.object({
      username_env: z.string(),
      password_env: z.string(),
      username_selector: z.string(),
      password_selector: z.string(),
      submit_selector: z.string(),
      login_url: z.string()
    }).optional(),
    storage_state_path: z.string().optional(),
    show_login_in_tutorial: z.boolean().default(false)
  }),
  seed: z.object({
    command: z.string(),
    skip_if_exists: z.string().optional()
  }).optional(),
  branding: z.object({
    logo_path: z.string().optional(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    intro_template: z.string().optional(),
    outro_template: z.string().optional(),
    outro_cta: z.string().optional()
  }).optional(),
  render: z.object({
    resolution: z.string().regex(/^\d+x\d+$/),
    fps: z.number().int().positive(),
    max_total_duration_s: z.number().positive(),
    max_segment_duration_s: z.number().positive()
  }),
  tts: z.object({
    provider: z.literal("gemini"),
    api_key_env: z.string(),
    language: z.string(),
    model: z.string().default("gemini-2.5-flash-preview-tts"),
    voices: z.object({
      friendly: z.string().default("Aoede"),
      pro: z.string().default("Charon"),
      hype: z.string().default("Fenrir"),
      founder: z.string().default("Orus"),
      documentary: z.string().default("Kore")
    }).default({ friendly: "Aoede", pro: "Charon", hype: "Fenrir", founder: "Orus", documentary: "Kore" }),
    speed_per_tone: z.object({
      friendly: z.number().default(1.0),
      pro: z.number().default(1.05),
      hype: z.number().default(1.10),
      founder: z.number().default(1.0),
      documentary: z.number().default(0.95)
    }).default({ friendly: 1.0, pro: 1.05, hype: 1.10, founder: 1.0, documentary: 0.95 }),
    chunk_max_chars: z.number().int().positive().default(800)
  }),
  anthropic: z.object({
    api_key_env: z.string().default("ANTHROPIC_API_KEY"),
    model: z.string().default("claude-sonnet-4-6"),
    max_concurrency: z.number().int().positive().default(4)
  }).default({ api_key_env: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6", max_concurrency: 4 }),
  script: z.object({
    depth: z.enum(["low", "medium", "high"]).default("medium"),
    tone: z.enum(["friendly", "pro", "hype", "founder", "documentary"]).default("friendly"),
    language: z.string().default("en-US")
  }).default({ depth: "medium", tone: "friendly", language: "en-US" }),
  record: z.object({
    headless: z.boolean().default(true),
    viewport: z.object({
      width: z.number().int().positive().default(1920),
      height: z.number().int().positive().default(1080)
    }).default({ width: 1920, height: 1080 }),
    selector_retry: z.number().int().nonnegative().default(3),
    selector_retry_backoff_ms: z.number().int().nonnegative().default(500),
    cursor_poll_hz: z.number().int().positive().default(60),
    auth_recover: z.boolean().default(true),
    gate_3_enabled: z.boolean().default(false),
    max_segment_concurrency: z.number().int().positive().default(1)
  }).default({
    headless: true, viewport: { width: 1920, height: 1080 },
    selector_retry: 3, selector_retry_backoff_ms: 500,
    cursor_poll_hz: 60, auth_recover: true,
    gate_3_enabled: false, max_segment_concurrency: 1
  }),
  compose: z.object({
    draft_resolution: z.string().regex(/^\d+x\d+$/).default("1920x1080"),
    final_resolution: z.string().regex(/^\d+x\d+$/).default("1920x1080"),
    fps: z.number().int().positive().default(30),
    watermark_text: z.string().default("DRAFT — TutorialVid"),
    music_volume: z.number().min(0).max(1).default(0.15),
    intro_template: z.string().default("minimal"),
    outro_template: z.string().default("cta-link"),
    outro_cta: z.string().optional(),
    music_override_path: z.string().optional(),
    cursor_size_px: z.number().int().positive().default(48),
    cursor_idle_hide_ms: z.number().int().positive().default(2000),
    parallel_segment_renders: z.number().int().positive().default(2)
  }).default({
    draft_resolution: "1920x1080",
    final_resolution: "1920x1080",
    fps: 30,
    watermark_text: "DRAFT — TutorialVid",
    music_volume: 0.15,
    intro_template: "minimal",
    outro_template: "cta-link",
    cursor_size_px: 48,
    cursor_idle_hide_ms: 2000,
    parallel_segment_renders: 2
  }),
  telemetry: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
});

export type Config = z.infer<typeof ConfigSchema>;
