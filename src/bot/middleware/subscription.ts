import type { Context, Next } from "grammy";
import { subscriptionService } from "../../services/subscription.js";
import { env } from "../../config/env.js";
import { getEnabledChannels, buildSubscriptionMessage, subscriptionKeyboard } from "../keyboards/subscription.js";
import { logger } from "../../utils/logger.js";

// Tracks users currently gated by subscription (not yet subscribed)
// We let the flow proceed only if subscribed. The gating happens in handlers,
// but we expose a helper here.

export async function ensureSubscribed(ctx: Context): Promise<boolean> {
  if (!env.FORCE_SUBSCRIPTION_ENABLED) return true;
  if (!ctx.me) return true;
  const bot = ctx.api;
  // use a minimal Bot-like wrapper
  const result = await subscriptionService.check(
    // grammY Bot has .api; we pass ctx.api as Bot-like via any
    { api: bot } as any,
    ctx.from!.id,
  );
  if (!result.ok) {
    const channels = getEnabledChannels();
    const text = buildSubscriptionMessage(channels);
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: subscriptionKeyboard(channels) }).catch(() => {});
      await ctx.answerCallbackQuery().catch(() => {});
    } else {
      await ctx.reply(text, { reply_markup: subscriptionKeyboard(channels) });
    }
    return false;
  }
  return true;
}

export async function subscriptionGateMiddleware(ctx: Context, next: Next): Promise<void> {
  // Only gate text messages that look like links (the main flow).
  // Commands and callback queries are handled in their own handlers.
  if (ctx.message && "text" in ctx.message) {
    const ok = await ensureSubscribed(ctx);
    if (!ok) return;
  }
  return next();
}

export { subscriptionService };