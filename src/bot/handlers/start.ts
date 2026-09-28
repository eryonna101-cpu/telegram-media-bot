import type { Bot, Context } from "grammy";
import { ensureSubscribed } from "../middleware/subscription.js";
import { welcomeKeyboard } from "../keyboards/user.js";

export function registerStart(bot: Bot): void {
  bot.command("start", async (ctx: Context) => {
    const ok = await ensureSubscribed(ctx);
    if (!ok) return;

    const name = ctx.from?.first_name ? ctx.from.first_name : "صديقي";
    const text = [
      `👋 أهلاً بك ${name}!`,
      ``,
      `أرسل رابط الفيديو وسأجهزه لك.`,
      ``,
      `🟢 النظام يعمل`,
    ].join("\n");

    await ctx.reply(text, { reply_markup: welcomeKeyboard() });
  });
}