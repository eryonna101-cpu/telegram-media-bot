import "dotenv/config";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { ensureBaseDirs } from "./utils/files.js";
import { getDb, closeDb } from "./database/database.js";
import { bot } from "./bot/bot.js";
import { getYtdlpVersion } from "./downloader/ytdlp.js";

async function bootstrap(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, "Starting Telegram Media Downloader Bot");

  await ensureBaseDirs();
  getDb(); // init + migrations

  // Log versions
  const ytdlp = await getYtdlpVersion().catch(() => "unknown");
  logger.info({ ytdlp, node: process.version }, "Runtime versions");

  // Start bot (long polling) with dropPendingUpdates to fix 409 conflict
  bot.start({
    dropPendingUpdates: true,
    onStart: (info) => {
      logger.info({ username: info.username }, "Bot started - polling");
    },
    allowed_updates: ["message", "callback_query", "chat_member"],
  });
}

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down...");
  bot.stop();
  closeDb();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal error during bootstrap");
  process.exit(1);
});
