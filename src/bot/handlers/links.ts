import type { Bot, Context } from "grammy";
import { logger } from "../../utils/logger.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function registerLinks(bot: Bot): void {
  bot.on("message:text", async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    if (text.startsWith("/")) return;

    if (!text.startsWith("http://") && !text.startsWith("https://")) {
      await ctx.reply("🔗 يرجى إرسال رابط صحيح يبدأ بـ http أو https فقط.");
      return;
    }

    const waitMsg = await ctx.reply("⏳ جاري معالجة الرابط وتحميل الفيديو...");

    try {
      // استقبال الرابط وتجهيز مسار التحميل المؤقت
      const url = text.trim();
      const outDir = path.join(os.tmpdir(), `bot-${Date.now()}`);
      fs.mkdirSync(outDir, { recursive: true });

      // محاكاة أو استدعاء مسار التحميل الخاص بك
      await ctx.reply(`📥 تم استلام الرابط بنجاح وجاري العمل عليه: \n${url}`);

      await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Link processing failed");
      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          waitMsg.message_id,
          `❌ عذراً، حدث خطأ أثناء المعالجة: ${(err as Error).message}`
        )
        .catch(() => {});
    }
  });
}
