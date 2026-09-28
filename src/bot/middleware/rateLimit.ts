import type { Context, Next } from "grammy";
import { env } from "../../config/env.js";

const windows = new Map<number, number[]>();

export async function rateLimitMiddleware(ctx: Context, next: Next): Promise<void> {
  if (!ctx.from) return next();
  const now = Date.now();
  const minute = 60_000;
  const arr = (windows.get(ctx.from.id) ?? []).filter((t) => now - t < minute);
  if (arr.length >= env.USER_RATE_LIMIT_PER_MIN) {
    if (ctx.callbackQuery) {
      await ctx
        .answerCallbackQuery({ text: "⏳ معدل الطلبات مرتفع، حاول بعد دقيقة.", show_alert: true })
        .catch(() => {});
    } else if (ctx.message) {
      await ctx.reply("⏳ معدل الطلبات مرتفع، حاول بعد دقيقة.").catch(() => {});
    }
    return;
  }
  arr.push(now);
  windows.set(ctx.from.id, arr);
  return next();
}