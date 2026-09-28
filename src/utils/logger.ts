import pino from "pino";
import { env } from "../config/env.js";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "tg-downloader-bot" },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
  redact: {
    paths: [
      "BOT_TOKEN",
      "botToken",
      "*.token",
      "*.BOT_TOKEN",
      "password",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;