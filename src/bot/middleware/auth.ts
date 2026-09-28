import type { Context, Next } from "grammy";
import { usersRepo } from "../../database/repositories/users.js";
import { env } from "../../config/env.js";
import { blockedMessage } from "../keyboards/user.js";

export async function authMiddleware(ctx: Context, next: Next): Promise<void> {
  if (!ctx.from) return;

  // Register / update user
  try {
    usersRepo.upsert({
      telegram_id: ctx.from.id,
      username: ctx.from.username ?? null,
      first_name: ctx.from.first_name ?? null,
      last_name: ctx.from.last_name ?? null,
      language_code: ctx.from.language_code ?? null,
      is_bot: ctx.from.is_bot ?? false,
    });
  } catch {
    // ignore registration errors
  }

  // Block check
  if (usersRepo.isBlocked(ctx.from.id)) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: blockedMessage(), show_alert: true }).catch(() => {});
    } else if (ctx.message) {
      await ctx.reply(blockedMessage());
    }
    return;
  }

  return next();
}

export function isOwner(ctx: Context): boolean {
  return !!ctx.from && ctx.from.id === env.OWNER_ID;
}