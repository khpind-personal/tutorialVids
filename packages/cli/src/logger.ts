import pino from "pino";

export const logger = pino({
  level: process.env.TV_LOG_LEVEL ?? "info"
});
