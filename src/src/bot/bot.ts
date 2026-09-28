import { Bot, session, InlineKeyboard } from "grammy";
import { env } from "../config/env.js";
import { errorBoundary } from "./middleware/errors.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { subscriptionService } from "../services/subscription.js";
import { getEnabledChannels, buildSubscriptionMessage, subscriptionKeyboard, retrySubKeyboard } from "./keyboards/subscription.js";
import { registerStart } from "./handlers/start.js";
import { registerLinks } from "./handlers/links.js";
import { registerDownloads } from "./handlers/downloads.js";
import { registerStats } from "./handlers/stats.js";
import { registerAdmin } from "./handlers/admin.js";
import { logger } from "../utils/logger.js";

export const bot = new Bot(env.BOT_TOKEN);

bot.use(
  session({
    initial: () => ({}),
  }),
);

bot.use(errorBoundary);
bot.use(authMiddleware);
bot.use(rateLimitMiddleware);

// Subscription verification callback
bot.callbackQuery("sub:check", async (ctx) => {
  const result = await subscriptionService.check({ api: ctx.api } as any, ctx.from!.id);
  if (result.ok) {
    await ctx.answerCallbackQuery({ text: "✅ تم التحقق." });
    const text = [
      `✅ تم التحقق من الاشتراك.`,
      ``,
      `أرسل رابط الفيديو وسأجهزه لك.`,
      `🟢 النظام يعمل`,
    ].join("\n");
    await ctx.editMessageText(text, {
      reply_markup: new InlineKeyboard()
        .text("ℹ️ المساعدة", "help:show")
        .text("📊 إحصائياتي", "stats:me"),
    });
  } else {
    subscriptionService.invalidate(ctx.from!.id);
    const channels = getEnabledChannels();
    await ctx.answerCallbackQuery({ text: "❌ لم تشترك في جميع القنوات.", show_alert: true });
    await ctx.editMessageText(buildSubscriptionMessage(channels), {
      reply_markup: retrySubKeyboard(),
    });
  }
});

registerStart(bot);
registerAdmin(bot);
registerDownloads(bot);
registerStats(bot);
registerLinks(bot);

bot.catch((err) => {
  logger.error({ err: err.error?.message, stack: err.error?.stack }, "Bot catch handler");
});

export default bot;