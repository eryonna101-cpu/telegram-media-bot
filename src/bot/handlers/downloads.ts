import type { Bot, Context } from "grammy";
import { InputFile } from "grammy";
import { downloadQueue } from "../../downloader/queue.js";
import { processDownload } from "../../downloader/engine.js";
import { createJobDir, cleanupPath } from "../../utils/files.js";
import { downloadsRepo } from "../../database/repositories/downloads.js";
import { usersRepo } from "../../database/repositories/users.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { formatChoiceKeyboard, progressKeyboard, afterDownloadKeyboard, errorKeyboard } from "../keyboards/download.js";
import type { DownloadJob, ProgressUpdate, MediaType } from "../../types/index.js";

interface JobContext {
  chatId: number;
  messageId: number;
  userId: number;
  downloadId: number;
}

const jobContexts = new Map<string, JobContext>();

function progressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  return `[${bar}] ${percent}%`;
}

function stageText(stage: ProgressUpdate["stage"], percent: number, message: string): string {
  return `${message}\n${progressBar(percent)}`;
}

async function updateStatus(ctx: JobContext, text: string, keyboard?: any): Promise<void> {
  try {
    await bot.api.editMessageText(ctx.chatId, ctx.messageId, text, keyboard ? { reply_markup: keyboard } : undefined);
  } catch {
    // ignore edit failures (e.g., content unchanged)
  }
}

let bot: Bot;

export function registerDownloads(botInstance: Bot): void {
  bot = botInstance;

  // Format choice
  bot.callbackQuery(/^dl:video$/, async (ctx: Context) => {
    await startDownload(ctx, "video");
  });
  bot.callbackQuery(/^dl:audio$/, async (ctx: Context) => {
    await startDownload(ctx, "audio");
  });
  bot.callbackQuery(/^dl:discard$/, async (ctx: Context) => {
    (ctx.session as any).pending = undefined;
    await ctx.editMessageText("❌ تم الإلغاء.", { reply_markup: undefined });
    await ctx.answerCallbackQuery();
  });

  // Cancel active job
  bot.callbackQuery(/^dl:cancel:(.+)$/, async (ctx: Context) => {
    const match = ctx.match as RegExpMatchArray | undefined;
    const jobId = match?.[1] ?? "";
    if (!jobId) {
      await ctx.answerCallbackQuery({ text: "تعذر الإلغاء." });
      return;
    }
    const cancelled = downloadQueue.cancel(jobId);
    if (cancelled) {
      await ctx.answerCallbackQuery({ text: "تم إلغاء التحميل." });
    } else {
      await ctx.answerCallbackQuery({ text: "تعذر إلغاء التحميل." });
    }
  });

  // Retry last link
  bot.callbackQuery(/^dl:retry$/, async (ctx: Context) => {
    const pending = (ctx.session as any).pending;
    if (!pending) {
      await ctx.answerCallbackQuery({ text: "لا يوجد رابط سابق." });
      return;
    }
    // re-show format choice
    await ctx.editMessageText(
      [
        `🔗 تم التعرف على الرابط`,
        ``,
        `🎬 العنوان: ${pending.title}`,
        `📱 المنصة: ${pending.platform}`,
        ``,
        `اختر الصيغة:`,
      ].join("\n"),
      { reply_markup: formatChoiceKeyboard() },
    );
    await ctx.answerCallbackQuery();
  });

  // Progress listener
  downloadQueue.on("progress", (jobId: string, u: ProgressUpdate) => {
    const jc = jobContexts.get(jobId);
    if (!jc) return;
    const text = stageText(u.stage, u.percent, u.message);
    updateStatus(jc, text, progressKeyboard(jobId)).catch(() => {});
  });

  downloadQueue.on("completed", async (jobId: string, result: any) => {
    const jc = jobContexts.get(jobId);
    if (!jc) return;
    try {
      await updateStatus(jc, "📤 جاري الإرسال...", progressKeyboard(jobId));
      const input = new InputFile(result.filePath);
      if (result.mediaType === "video") {
        await bot.api.sendVideo(jc.chatId, input, {
          caption: `✅ ${result.title}\n${result.platform}`,
          supports_streaming: true,
        });
      } else {
        await bot.api.sendAudio(jc.chatId, input, {
          caption: `✅ ${result.title}\n${result.platform}`,
        });
      }
      downloadsRepo.setStatus(jc.downloadId, "completed");
      downloadsRepo.update(jc.downloadId, {
        file_size: result.fileSize,
        duration: result.duration,
        title: result.title,
        platform: result.platform,
      });
      usersRepo.incrementDownload(jc.userId, true, result.mediaType);

      await updateStatus(
        jc,
        `✅ تم التحميل بنجاح\n${result.title}`,
        afterDownloadKeyboard(),
      );
    } catch (err) {
      logger.error({ err: (err as Error).message, jobId }, "Send failed");
      downloadsRepo.setStatus(jc.downloadId, "failed", (err as Error).message);
      usersRepo.incrementDownload(jc.userId, false, result.mediaType);
      await updateStatus(jc, "❌ تعذر إرسال الملف.", errorKeyboard()).catch(() => {});
    } finally {
      await cleanupPath(createJobDir(jobId).dir);
      jobContexts.delete(jobId);
    }
  });

  downloadQueue.on("failed", async (jobId: string, err: Error) => {
    const jc = jobContexts.get(jobId);
    if (!jc) return;
    logger.warn({ err: err.message, jobId }, "Job failed");
    downloadsRepo.setStatus(jc.downloadId, "failed", err.message);
    usersRepo.incrementDownload(jc.userId, false, (jc as any).mediaType ?? "video");
    await updateStatus(jc, "❌ تعذر تحميل الملف.", errorKeyboard()).catch(() => {});
    await cleanupPath(createJobDir(jobId).dir);
    jobContexts.delete(jobId);
  });

  downloadQueue.on("cancelled", async (jobId: string) => {
    const jc = jobContexts.get(jobId);
    if (!jc) return;
    downloadsRepo.setStatus(jc.downloadId, "cancelled");
    await updateStatus(jc, "❌ تم إلغاء التحميل.").catch(() => {});
    await cleanupPath(createJobDir(jobId).dir);
    jobContexts.delete(jobId);
  });
}

async function startDownload(ctx: Context, mediaType: MediaType): Promise<void> {
  const pending = (ctx.session as any).pending;
  if (!pending) {
    await ctx.answerCallbackQuery({ text: "أرسل رابطًا أولاً." });
    return;
  }

  const user = usersRepo.getByTelegramId(ctx.from!.id);
  if (!user) {
    await ctx.answerCallbackQuery({ text: "حدث خطأ، حاول /start" });
    return;
  }

  // create DB record
  const downloadId = downloadsRepo.create({
    user_id: user.id,
    url: pending.url,
    platform: pending.platform ?? "other",
    media_type: mediaType,
  });

  const { jobId, dir } = createJobDir();

  const statusMsg = await ctx.editMessageText(
    `⏳ جاري تجهيز ${mediaType === "video" ? "الفيديو" : "الصوت"}...\n${progressBar(0)}`,
    { reply_markup: progressKeyboard(jobId) },
  );

  jobContexts.set(jobId, {
    chatId: ctx.chat!.id,
    messageId: statusMsg.message_id,
    userId: ctx.from!.id,
    downloadId,
  });
  (jobContexts.get(jobId) as any).mediaType = mediaType;

  await ctx.answerCallbackQuery();

  const job = downloadQueue.enqueue({
    userId: ctx.from!.id,
    url: pending.url,
    mediaType,
    process: async (j: DownloadJob, onProgress: (u: ProgressUpdate) => void) => {
      const result = await processDownload({
        url: pending.url,
        mediaType,
        outDir: dir,
        signal: j.abort.signal,
        onProgress,
      });
      return {
        filePath: result.filePath,
        fileSize: result.fileSize,
        title: result.title,
        platform: result.platform,
        duration: result.duration,
        mediaType,
      };
    },
  });

  // Safety net: cancel if still running after timeout
  setTimeout(() => {
    if (job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled") {
      downloadQueue.cancel(job.id);
    }
  }, env.DOWNLOAD_TIMEOUT_SECONDS * 1000);
}