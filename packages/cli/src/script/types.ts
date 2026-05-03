export interface NarrationAlignment {
  phrase: string;
  action_t_ms: number;
}

export interface Narration {
  text: string;
  ssml: string;
  alignments: NarrationAlignment[];
}

export interface SceneAction {
  t_ms: number;
  type: "nav" | "wait" | "type" | "click";
  beat?: string;
  selector?: string;
  url?: string;
  text?: string;
  narration_phrase?: string;
  zoom?: { scale: number; in_ms: number; hold_ms: number; out_ms: number };
  ripple?: boolean;
  callout?: { text: string; anchor: "auto" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"; duration_ms: number; max_width?: number };
  highlight?: {
    target_selector?: string;
    style?: "spotlight" | "frame" | "both" | "glow";
    duration_ms?: number;
    intensity?: number;
    pad?: number;
    radius?: number;
    pulse?: boolean;
    bbox?: { x: number; y: number; w: number; h: number };
  };
  highlight_score?: number;
}

export interface SceneJson {
  segment_id: string;
  page_id: string;
  role: string;
  role_label?: string;
  is_common?: boolean;
  depth: "low" | "medium" | "high";
  tone: string;
  target_duration_s: number;
  actions: SceneAction[];
  narration: Narration;
}
