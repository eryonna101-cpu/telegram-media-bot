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

    const waitMsg = await ctx.reply("🔍 جاري معالجة وتحميل الرابط...");

    try {
      const url = text.trim();

      // استخدام الرابط الرسمي المعتمد للخدمة
      const response = await fetch("https://co.wuk.sh/api/json", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url,
          vQuality: "720"
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: any = await response.json();
      const mediaUrl = data.url || (data.picker && data.picker[0]?.url);

      if (!mediaUrl) {
        throw new Error(data.text || "لم يتم العثور على رابط تحميل مباشر.");
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
