import { logger } from "../logger.js";

export interface TelemetryEvent {
  stage: string;
  duration_ms: number;
  segment_count?: number;
  error?: string;
}

export async function send(enabled: boolean, event: TelemetryEvent): Promise<void> {
  if (!enabled) return;
  logger.info({ telemetry: event }, "telemetry event");
}
