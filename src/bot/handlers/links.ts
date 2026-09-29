import type { Bot, Context } from "grammy";
import { logger } from "../../utils/logger.js";

export function registerLinks(bot: Bot): void {
  bot.on("message:text", async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    if (text.startsWith("/")) return;

    if (!text.startsWith("http://") && !text.startsWith("https://")) {
      await ctx.reply("🔗 يرجى إرسال رابط صحيح يبدأ بـ http أو https فقط.");
      return;
    }

    const waitMsg = await ctx.reply("🔍 جاري جلب رابط التحميل...");

    try {
      const url = text.trim();

      // استخدام خدمة بديلة ومستقرة لمعالجة الروابط
      const apiUrl = `https://p.surl.co/api/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`);
      }

      const data: any = await response.json();
      const mediaUrl = data.url || data.download_url || data.link;

      if (!mediaUrl) {
        throw new Error("لم يتم العثور على رابط تحميل مباشر لهذا الفيديو.");
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        waitMsg.message_id,
        `✅ تم تجهيز الفيديو بنجاح!\n🔗 الرابط المباشر:\n${mediaUrl}`
      );

    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Download failed");
      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          waitMsg.message_id,
          `❌ عذراً، حدث خطأ أثناء معالجة الرابط: ${(err as Error).message}`
        )
        .catch(() => {});
    }
  });
}
