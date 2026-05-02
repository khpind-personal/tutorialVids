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
  selector?: string;
  url?: string;
  text?: string;
  zoom?: { scale: number; in_ms: number; hold_ms: number; out_ms: number };
  ripple?: boolean;
  callout?: { text: string; anchor: "left" | "right" | "top" | "bottom"; duration_ms: number };
  highlight_score?: number;
}

export interface SceneJson {
  segment_id: string;
  page_id: string;
  depth: "low" | "medium" | "high";
  tone: string;
  target_duration_s: number;
  actions: SceneAction[];
  narration: Narration;
}
