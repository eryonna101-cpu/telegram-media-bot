import type { Bot } from "grammy";
import { env } from "../config/env.js";
import { channelsRepo } from "../database/repositories/channels.js";
import { logger } from "../utils/logger.js";
import type { ChannelRow } from "../types/index.js";

interface CacheEntry {
  ok: boolean;
  missing: ChannelRow[];
  at: number;
}

const cache = new Map<number, CacheEntry>();

export const subscriptionService = {
  async check(bot: Bot, userId: number): Promise<{ ok: boolean; missing: ChannelRow[] }> {
    if (!env.FORCE_SUBSCRIPTION_ENABLED) return { ok: true, missing: [] };

    const cached = cache.get(userId);
    if (cached && Date.now() - cached.at < env.SUBSCRIPTION_CACHE_TTL_SECONDS * 1000) {
      return { ok: cached.ok, missing: cached.missing };
    }

    const channels = channelsRepo.listEnabled();
    if (channels.length === 0) {
      cache.set(userId, { ok: true, missing: [], at: Date.now() });
      return { ok: true, missing: [] };
    }

    const missing: ChannelRow[] = [];
    for (const ch of channels) {
      try {
        const member = await bot.api.getChatMember(ch.chat_id, userId);
        const status = member.status;
        if (status !== "member" && status !== "administrator" && status !== "creator") {
          missing.push(ch);
        }
      } catch (err) {
        // Telegram API failure → treat as NOT subscribed (never auto-pass)
        logger.warn({ chatId: ch.chat_id, userId, err: (err as Error).message }, "Subscription check failed");
        missing.push(ch);
      }
    }

    const ok = missing.length === 0;
    cache.set(userId, { ok, missing, at: Date.now() });
    return { ok, missing };
  },

  invalidate(userId: number): void {
    cache.delete(userId);
  },
};