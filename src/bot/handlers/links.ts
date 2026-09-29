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

    const waitMsg = await ctx.reply("🔍 جاري معالجة الرابط عبر Cobalt...");

    try {
      const url = text.trim();

      const cobaltApiUrl = "https://api.cobalt.tools/api/json";
      const response = await fetch(cobaltApiUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url,
          vQuality: "720",
          filenameStyle: "pretty"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status}: ${errText}`);
      }

      const data: any = await response.json();

      if (data.status === "error" || (!data.url && !data.picker)) {
        throw new Error(data.text || "فشل جلب الرابط من سيرفر Cobalt");
      }

      const mediaUrl = data.url || (data.picker && data.picker[0]?.url);

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
