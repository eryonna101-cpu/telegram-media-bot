import "dotenv/config";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { ensureBaseDirs } from "./utils/files.js";
import { getDb, closeDb } from "./database/database.js";
import { cleanupService } from "./services/cleanup.js";
import { bot } from "./bot/bot.js";
import { getYtdlpVersion } from "./downloader/ytdlp.js";
import { getFfmpegVersion } from "./downloader/ffmpeg.js";

async function bootstrap(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, "Starting Telegram Media Downloader Bot");

  await ensureBaseDirs();
  getDb(); // init + migrations

  // Log versions
  const ytdlp = await getYtdlpVersion().catch(() => "unknown");
  const ffmpeg = await getFfmpegVersion().catch(() => "unknown");
  logger.info({ ytdlp, ffmpeg, node: process.versions.node }, "Runtime versions");

  // Start cleanup worker
  cleanupService.start();
  // Run an initial cleanup pass
  await cleanupService.runOnce().catch(() => {});

  // Start bot (long polling)
  bot.start({
    onStart: (info) => {
      logger.info({ username: info.username }, "Bot started — polling");
    },
    allowed_updates: ["message", "callback_query", "chat_member"],
  });
}

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down...");
  bot.stop();
  closeDb();
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch((err) => {
  logger.fatal({ err: (err as Error).message, stack: (err as Error).stack }, "Fatal bootstrap error");
  process.exit(1);
});