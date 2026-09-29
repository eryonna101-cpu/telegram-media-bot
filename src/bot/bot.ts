import { Bot, session, InlineKeyboard } from "grammy";
import { env } from "../config/env.js";
import { errorBoundary } from "./middleware/errorBoundary.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { subscriptionService } from "../services/subscription.js";
import { getEnabledChannels, buildSubscriptionMessage, retrySubKeyboard } from "./helpers/subscription.js";
import { registerStart } from "./handlers/start.js";
import { registerLinks } from "./handlers/links.js";
import { registerDownloads } from "./handlers/downloads.js";
import { registerStats } from "./handlers/stats.js";
import { registerAdmin } from "./handlers/admin.js";
import { logger } from "../utils/logger.js";

export const bot = new Bot<any>(env.BOT_TOKEN);

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
  const result = await subscriptionService.verify(ctx.from.id);
  if (result.ok) {
    await ctx.answerCallbackQuery({ text: "تم التحقق بنجاح!" });
    const text = [
      "✅ تم التحقق من الاشتراك بنجاح.",
      "",
      "أرسل رابط الفيديو وسأجهزه لك الآن",
      "🟢 النظام يعمل بكفاءة."
    ].join("\n");
    await ctx.editMessageText(text, {
      reply_markup: new InlineKeyboard()
        .text("ℹ️ المساعدة", "help:show")
        .text("📊 إحصائيات", "stats:show"),
    });
  } else {
    subscriptionService.invalidate(ctx.from.id);
    const channels = getEnabledChannels();
    await ctx.answerCallbackQuery({ text: "يرجى الاشتراك في القنوات أولاً" });
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
  const e = err.error as Error;
  logger.error({ err: e.message, stack: e.stack });
});

export default bot;
