export interface CursorEvent {
  t_ms: number;
  x: number;
  y: number;
  event: "move" | "down" | "up";
}

export interface CursorTrack {
  events: CursorEvent[];
}

export interface RecordSegmentResult {
  segment_id: string;
  mp4_path: string;
  cursor_track_path: string;
  duration_ms: number;
}

export type AuthMode = "credentials" | "storage_state" | "inline";
