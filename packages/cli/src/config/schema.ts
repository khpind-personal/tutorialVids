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
    language: z.string()
  }),
  telemetry: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
});

export type Config = z.infer<typeof ConfigSchema>;
