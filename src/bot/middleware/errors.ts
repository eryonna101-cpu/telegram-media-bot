import type { Context, Next } from "grammy";
import { logger } from "../../utils/logger.js";

export async function errorBoundary(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err) {
    const e = err as Error;
    logger.error(
      {
        err: e.message,
        stack: e.stack,
        userId: ctx.from?.id,
        updateId: ctx.update.update_id,
      },
      "Unhandled error in update",
    );
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "حدث خطأ غير متوقع.", show_alert: true }).catch(() => {});
      } else if (ctx.message) {
        await ctx.reply("❌ حدث خطأ غير متوقع. تم تسجيل الخطأ.").catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}