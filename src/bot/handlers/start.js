import { mainMenu } from "../keyboards/main.js";
import { session } from "../utils/session.js";
import { escapeHtml, noop } from "../utils/files.js";

export function registerStartHandler(bot) {
  const welcomeText = (ctx) =>
    `👋 أهلًا ${escapeHtml(ctx.from.first_name || "")}!\n\n` +
    `أنا بوت تحميل الفيديوهات من TikTok وInstagram.\n\n` +
    `🎬 اضغط زر «تحميل فيديو» ثم أرسل الرابط — كل شيء من الأزرار بالأسفل.`;

  bot.command("start", async (ctx) => {
    await ctx.reply(welcomeText(ctx), {
      parse_mode: "HTML",
      reply_markup: mainMenu(ctx.from.id),
    });
  });

  bot.callbackQuery("menu:home", async (ctx) => {
    await ctx.answerCallbackQuery().catch(noop);
    session.clear(ctx.from.id);
    await ctx
      .editMessageText(welcomeText(ctx), {
        parse_mode: "HTML",
        reply_markup: mainMenu(ctx.from.id),
      })
      .catch(noop);
  });
}