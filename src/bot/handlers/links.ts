import type { Bot, Context } from "grammy";
import { validateMediaUrl, isLikelyUrl } from "../../utils/urls.js";
import { extractInfo, formatInfoCard, estimateSizeOk } from "../../downloader/engine.js";
import { PLATFORM_ICON, PLATFORM_LABEL } from "../../downloader/detector.js";
import { formatChoiceKeyboard, unsupportedKeyboard } from "../keyboards/download.js";
import { ensureSubscribed } from "../middleware/subscription.js";
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
    const text = ctx.message.text;

    // ignore commands
    if (text.startsWith("/")) return;

    const ok = await ensureSubscribed(ctx);
    if (!ok) return;

    const validation = validateMediaUrl(text);
    if (!validation.ok || !validation.url) {
      if (isLikelyUrl(text)) {
        await ctx.reply(
          `❌ الرابط غير صالح.\nتأكد أنه يبدأ بـ http(s):// ولموجه عام.`,
          { reply_markup: unsupportedKeyboard() },
        );
      } else {
        await ctx.reply(
          `🔗 أرسل رابط الفيديو فقط.\n\nمثال:\nhttps://www.youtube.com/watch?v=...`,
        );
      }
      return;
    }

    const url = validation.url;
    const waitMsg = await ctx.reply("🔍 جاري التعرف على الرابط...");

    try {
      const controller = new AbortController();
      const info = await extractInfo(url, controller.signal);

      // store pending in session
      (ctx.session as any).pending = {
        url,
        title: info.title,
        platform: info.platform,
        duration: info.duration,
      } satisfies PendingInfo;

      let card = formatInfoCard(info);
      if (!estimateSizeOk(info)) {
        card = `❌ الملف كبير جدًا للإرسال عبر Telegram (الحد ${MAX_FILE_SIZE_MB}MB).`;
        await ctx.api.editMessageText(
          ctx.chat!.id,
          waitMsg.message_id,
          card,
          { reply_markup: unsupportedKeyboard() },
        );
        return;
      }

      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, card, {
        reply_markup: formatChoiceKeyboard(),
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, url }, "Link detection failed");
      await ctx.api
        .editMessageText(
          ctx.chat!.id,
          waitMsg.message_id,
          `❌ هذا الرابط غير مدعوم حاليًا.\n${PLATFORM_ICON.other} المنصة: غير معروفة`,
          { reply_markup: unsupportedKeyboard() },
        )
        .catch(() => {});
    }
  });
}