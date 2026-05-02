import type { Framework } from "../scan/types.js";

export type Depth = "low" | "medium" | "high";
export type Tone = "friendly" | "pro" | "hype" | "founder" | "documentary";

export interface Segment {
  id: string;
  page_id: string;
  page_route: string;
  page_title: string;
  depth: Depth;
  tone: Tone;
  target_duration_s: number;
  importance: number;
  requires_auth: boolean;
  role: string;
  role_label?: string;
  is_common?: boolean;
}

export interface Plan {
  framework: Framework;
  base_url: string;
  depth: Depth;
  tone: Tone;
  language: string;
  segments: Segment[];
  roles: { id: string; label: string }[];
  created_at: string;
}

export interface PickerInput {
  pages: { id: string; route: string; title: string; importance: number; requires_auth: boolean }[];
  selected: string[];
  defaultTopN?: number;
}
