import type { Bot, Context } from "grammy";
import { statisticsService } from "../../services/statistics.js";
import { helpKeyboard, homeKeyboard } from "../keyboards/user.js";

export function registerStats(bot: Bot): void {
  bot.callbackQuery(/^stats:me$/, async (ctx: Context) => {
    const stats = statisticsService.getUserStats(ctx.from!.id);
    if (!stats) {
      await ctx.answerCallbackQuery({ text: "لا توجد بيانات بعد." });
      return;
    }
    const text = [
      `📊 إحصائياتي`,
      `────────────`,
      `👤 حسابك: ${ctx.from!.first_name ?? ""}`,
      ``,
      `📥 إجمالي التحميلات: ${stats.downloads}`,
      `🎬 فيديو: ${stats.video}`,
      `🎵 MP3: ${stats.audio}`,
      `✅ ناجح: ${stats.successful}`,
      `❌ فشل: ${stats.failed}`,
      ``,
      `📅 عضو منذ: ${stats.joinedAt}`,
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: homeKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^help:show$/, async (ctx: Context) => {
    const text = [
      `ℹ️ المساعدة`,
      `────────────`,
      `• أرسل رابط الفيديو مباشرة.`,
      `• اختر 🎬 فيديو أو 🎵 MP3.`,
      `• سيتم تجهيز الملف وإرساله لك.`,
      ``,
      `المنصات المدعومة: YouTube, TikTok, Instagram, Facebook, Twitter وغيرها عبر yt-dlp.`,
      `لا يتم تجاوز الحسابات الخاصة أو DRM أو المحتوى المحمي.`,
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: helpKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^home:show$/, async (ctx: Context) => {
    const text = [
      `🏠 الرئيسية`,
      ``,
      `أرسل رابط الفيديو وسأجهزه لك.`,
      `🟢 النظام يعمل`,
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: homeKeyboard() });
    await ctx.answerCallbackQuery();
  });
}