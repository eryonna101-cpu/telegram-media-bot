import { InputFile } from "grammy";
import fs from "node:fs";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { session } from "../utils/session.js";
import { progressBar, escapeHtml, fmtBytes, removeDir, noop } from "../utils/files.js";
import { platformLabel } from "../utils/links.js";
import { downloadQueue } from "../services/queue.js";
import * as downloader from "../services/downloader.js";
import { createDownload, updateDownload, incUserStats } from "../database/models.js";
import {
  linkPromptKeyboard,
  cancelKeyboard,
  successKeyboard,
  errorKeyboard,
} from "../keyboards/download.js";
import { backHome } from "../keyboards/main.js";

const TELEGRAM_LIMIT = 49 * 1024 * 1024; // حد تيليجرام للبوتات ~50MB
const activeJobs = new Map(); // userId -> jobId

async function safeEdit(api, chatId, messageId, text, reply_markup) {
  try {
    await api.editMessageText(chatId, messageId, text, {
      parse_mode: "HTML",
      reply_markup,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    const msg = String(err.message || "");
    if (!/not modified|not found|message to edit not found/.test(msg)) {
      logger.warn(`editMessageText failed: ${msg.slice(0, 150)}`);
    }
  }
}

export function registerDownloadHandler(bot) {
  // زر «تحميل فيديو» — طلب الرابط
  bot.callbackQuery("dl:menu", async (ctx) => {
    await ctx.answerCallbackQuery().catch(noop);
    session.update(ctx.from.id, { waitingFor: "link" });
    await safeEdit(
      bot.api,
      ctx.chat.id,
      ctx.callbackQuery.message.message_id,
      "🎬 أرسل الآن رابط الفيديو من TikTok أو Instagram.\n\n⚠️ المحتوى الخاص غير مدعوم — الروابط العامة فقط.",
      linkPromptKeyboard()
    );
  });

  // أزرار التحميل (فيديو / صوت)
  bot.callbackQuery(["dl:video", "dl:audio"], async (ctx) => {
    const userId = ctx.from.id;
    if (activeJobs.has(userId)) {
      await ctx.answerCallbackQuery("⏳ لديك تحميل جارٍ بالفعل، انتظر انتهاءه.").catch(noop);
      return;
    }
    const s = session.get(userId);
    if (!s?.url) {
      await ctx.answerCallbackQuery().catch(noop);
      await safeEdit(
        bot.api,
        ctx.chat.id,
        ctx.callbackQuery.message.message_id,
        "⚠️ انتهت الجلسة — اضغط «تحميل فيديو» وأرسل الرابط من جديد.",
        backHome()
      );
      return;
    }
    await ctx.answerCallbackQuery().catch(noop);
    await runDownload(bot, ctx, {
      url: s.url,
      platform: s.platform,
      info: s.info || null,
      audioOnly: ctx.callbackQuery.data === "dl:audio",
    });
  });

  // زر الإلغاء
  bot.callbackQuery("dl:cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(noop);
    const jobId = activeJobs.get(ctx.from.id);
    if (jobId) {
      downloadQueue.cancel(jobId); // معالج المهمة سيحدّث الرسالة
      return;
    }
    session.update(ctx.from.id, { waitingFor: null });
    await safeEdit(
      bot.api,
      ctx.chat.id,
      ctx.callbackQuery.message.message_id,
      "❌ تم الإلغاء.",
      backHome()
    );
  });
}

async function runDownload(bot, ctx, { url, platform, audioOnly, info }) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const statusMsgId = ctx.callbackQuery.message.message_id;

  const recordId = createDownload({
    user_id: userId,
    platform,
    url,
    media_type: audioOnly ? "audio" : "video",
  });
  const jobId = `dl-${recordId}`;
  activeJobs.set(userId, jobId);
  incUserStats(userId, "downloads");

  const startedAt = Date.now();
  let lastPct = -1;
  let lastEditAt = 0;
  const onProgress = (pct) => {
    const now = Date.now();
    if (pct === lastPct || (now - lastEditAt < 2500 && pct < 100)) return;
    lastPct = pct;
    lastEditAt = now;
    safeEdit(
      bot.api,
      chatId,
      statusMsgId,
      `⏳ جاري التحميل…\n\n${progressBar(pct)} ${Math.floor(pct)}%`,
      cancelKeyboard()
    );
  };

  await safeEdit(
    bot.api,
    chatId,
    statusMsgId,
    `⏳ جاري التحميل…\n\n${progressBar(0)} 0%\n\n🔎 جاري تجهيز الملف…`,
    cancelKeyboard()
  );

  let jobDir = null;
  try {
    const result = await downloadQueue.run(
      jobId,
      (signal) =>
        downloader.download(url, { audioOnly, signal, onProgress, platform }),
      { timeoutMs: config.downloadTimeoutSec * 1000, retries: config.maxRetries }
    );
    jobDir = result.dir;
    const size = fs.statSync(result.filePath).size;
    if (size > Math.min(config.maxFileSize, TELEGRAM_LIMIT)) {
      throw new Error("الملف أكبر من الحد المسموح");
    }

    const title = info?.title || platformLabel(platform);
    const caption = audioOnly ? `🎵 ${escapeHtml(title)}` : `🎬 ${escapeHtml(title)}`;
    if (audioOnly) {
      await bot.api.sendAudio(chatId, new InputFile(result.filePath), {
        caption,
        title: String(title).slice(0, 60),
        performer: platformLabel(platform),
      });
    } else {
      await bot.api.sendVideo(chatId, new InputFile(result.filePath), {
        caption,
        supports_streaming: true,
        duration: Math.round(info?.duration || 0),
      });
    }

    await safeEdit(
      bot.api,
      chatId,
      statusMsgId,
      `✅ تم التحميل بنجاح\n\n📦 ${fmtBytes(size)}${info?.duration ? ` · ⏱️ ${Math.round(info.duration)} ثانية` : ""}`,
      successKeyboard(audioOnly)
    );
    updateDownload(recordId, {
      status: "completed",
      file_size: size,
      duration: info?.duration || null,
      completed_at: new Date().toISOString(),
    });
    incUserStats(userId, "success");
    logger.info("download completed", {
      user_id: userId,
      platform,
      media_type: audioOnly ? "audio" : "video",
      file_size: size,
      ms: Date.now() - startedAt,
    });
  } catch (err) {
    const cancelled = err.cancelled === true;
    updateDownload(recordId, {
      status: cancelled ? "cancelled" : "failed",
      error: cancelled ? null : String(err.message).slice(0, 400),
      completed_at: new Date().toISOString(),
    });
    if (cancelled) {
      await safeEdit(bot.api, chatId, statusMsgId, "❌ تم إلغاء التحميل.", backHome());
    } else {
      incUserStats(userId, "errors");
      logger.error("download failed", {
        user_id: userId,
        platform,
        ms: Date.now() - startedAt,
        error: String(err.message).slice(0, 400),
      });
      // لا نعرض الخطأ الحقيقي للمستخدم — فقط في السجلات
      await safeEdit(
        bot.api,
        chatId,
        statusMsgId,
        "❌ تعذر تحميل الرابط.\n\nتأكد أن المحتوى عام ومتاح، ثم حاول مرة أخرى.",
        errorKeyboard(audioOnly)
      );
    }
  } finally {
    activeJobs.delete(userId);
    if (jobDir) await removeDir(jobDir); // تنظيف الملفات المؤقتة دائمًا
  }
}