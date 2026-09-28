import type { Bot } from "grammy";
import { usersRepo } from "../database/repositories/users.js";
import { broadcastsRepo, adminActionsRepo } from "../database/repositories/settings.js";
import { logger } from "../utils/logger.js";

export const broadcastService = {
  async send(bot: Bot, adminId: number, text: string): Promise<void> {
    const ids = usersRepo.allTelegramIds();
    const broadcastId = broadcastsRepo.create(adminId, text, ids.length);
    adminActionsRepo.log(adminId, "broadcast", null, text.slice(0, 200));

    let sent = 0;
    let failed = 0;
    const BATCH = 25; // Telegram ~30/sec; keep conservative
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (tid) => {
          try {
            await bot.api.sendMessage(tid, text, { parse_mode: "HTML", disable_web_page_preview: true });
            sent++;
          } catch (err) {
            failed++;
            logger.warn({ tid, err: (err as Error).message }, "Broadcast send failed");
          }
        }),
      );
      // ~1 sec between batches to avoid flood
      await new Promise((r) => setTimeout(r, 1000));
    }
    broadcastsRepo.markSent(broadcastId, sent, failed);
    logger.info({ broadcastId, sent, failed }, "Broadcast completed");
  },
};