import type { Bot, Context } from "grammy";
import { validateMediaUrl, isLikelyUrl } from "../../downloader/detector.js";
import { extractInfo, estimateSizeOk } from "../../downloader/engine.js";
import { PLATFORM_ICON, PLATFORM_LABEL } from "../../downloader/index.js";
import { formatChoiceKeyboard, unsupportedKeyboard } from "../keyboards/index.js";
import { ensureSubscribed } from "../middlewares/subscription.js";
import { MAX_FILE_SIZE_MB } from "../../config/env.js";
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

    if (text.startsWith("/")) return;

    const ok = await ensureSubscribed(ctx);
    if (!ok) return;

    const validation = validateMediaUrl(text);
    if (!validation.ok || !validation.url) {
      if (isLikelyUrl(text)) {
        await ctx.reply("❌ عذراً، هذا الرابط غير مدعوم حالياً.", { reply_markup: unsupportedKeyboard() });
      } else {
        await ctx.reply("🔗 يرجى إرسال رابط فيديو صحيح.");
      }
      return;
    }

    const url = validation.url;
    const waitMsg = await ctx.reply("🔍 جاري فحص الرابط...");

    try {
      const controller = new AbortController();
      const info = await extractInfo(url, controller.signal);

      (ctx.session as any).pending = {
        url,
        title: info.title,
        platform: info.platform,
        duration: info.duration,
      } satisfies PendingInfo;

      await ctx.api.editMessageText(
        ctx.chat!.id,
        waitMsg.message_id,
        `📥 **${info.title}**\n📌 المنصة: ${PLATFORM_LABEL[info.platform] || info.platform}\n\nاختر جودة التحميل:`,
        { reply_markup: formatChoiceKeyboard() }
      );

    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Link processing failed");
      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          waitMsg.message_id,
          `❌ عذراً، لم نتمكن من معالجة هذا الرابط.`
        )
        .catch(() => {});
    }
  });
}
