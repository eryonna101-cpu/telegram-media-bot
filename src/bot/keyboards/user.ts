import { InlineKeyboard } from "grammy";

export function welcomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("ℹ️ المساعدة", "help:show")
    .text("📊 إحصائياتي", "stats:me");
}

export function homeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("ℹ️ المساعدة", "help:show")
    .text("📊 إحصائياتي", "stats:me");
}

export function helpKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 الرئيسية", "home:show");
}

export function blockedMessage(): string {
  return "🚫 حسابك محظور من استخدام البوت.";
}