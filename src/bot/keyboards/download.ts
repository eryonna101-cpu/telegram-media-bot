import { InlineKeyboard } from "grammy";

export function formatChoiceKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎬 تحميل فيديو", "dl:video")
    .text("🎵 تحميل MP3", "dl:audio")
    .row()
    .text("❌ إلغاء", "dl:discard");
}

export function progressKeyboard(jobId: string): InlineKeyboard {
  return new InlineKeyboard().text("❌ إلغاء", `dl:cancel:${jobId}`);
}

export function afterDownloadKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 تحميل مرة أخرى", "dl:retry")
    .row()
    .text("🏠 الرئيسية", "home:show");
}

export function errorKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 إعادة المحاولة", "dl:retry")
    .row()
    .text("🏠 الرئيسية", "home:show");
}

export function unsupportedKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔗 إرسال رابط آخر", "home:show");
}