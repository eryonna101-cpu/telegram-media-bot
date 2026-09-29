import type { Bot, Context } from "grammy";
import { ensureSubscribed } from "../middlewares/subscription.js";
import { logger } from "../../utils/logger.js";

interface PendingInfo {
  url: string;
  title: string;
  platform: string;
  duration: number;
}

export function registerLinks(bot: Bot): void {
  bot.on("message:text", async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    // ignore commands
    if (text.startsWith("/")) return;

    const ok = await ensureSubscribed(ctx);
    if (!ok) return;

    // التحقق البسيط من أن النص يبدو كرابط
    if (!text.startsWith("http://") && !text.startsWith("https://")) {
      await ctx.reply("🔗 يرجى إرسال رابط صحيح يبدأ بـ http أو https فقط.");
      return;
    }

    const waitMsg = await ctx.reply("🔍 جاري معالجة الرابط عبر Cobalt...");

    try {
      const url = text.trim();

      // تخزين بيانات مؤقتة وجلب التحميل مباشرة
      const cobaltApiUrl = "https://api.cobalt.tools/api/json";
      const response = await fetch(cobaltApiUrl, {
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
        throw new Error(`Cobalt API failed with status ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status === "error" || !data.url) {
        throw new Error(data.text || "فشل جلب الرابط من سيرفر Cobalt");
      }

      // إرسال الملف مباشرة للمستخدم
      await ctx.api.editMessageText(
        ctx.chat!.id,
        waitMsg.message_id,
        `✅ تم تجهيز الفيديو بنجاح!\n🔗 الرابط المباشر:\n${data.url}`
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
