import { InlineKeyboard } from "grammy";

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 الإحصائيات", "admin:stats")
    .text("👥 المستخدمون", "admin:users")
    .row()
    .text("📥 التحميلات", "admin:downloads")
    .text("📢 الاشتراك الإجباري", "admin:subs")
    .row()
    .text("📣 Broadcast", "admin:broadcast")
    .text("🚫 الحظر", "admin:blocked")
    .row()
    .text("⚙️ إعدادات", "admin:settings")
    .text("🧰 النظام", "admin:system")
    .row()
    .text("📝 Logs", "admin:logs")
    .text("🏠 الرئيسية", "home:show");
}

export function adminStatsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 تحديث", "admin:stats")
    .row()
    .text("🔙 لوحة الأدمن", "admin:menu");
}

export function adminUsersKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 جميع المستخدمين", "admin:users:all")
    .text("🔎 بحث عن مستخدم", "admin:users:search")
    .row()
    .text("🚫 المحظورون", "admin:users:blocked")
    .row()
    .text("🔙 لوحة الأدمن", "admin:menu");
}

export function adminSubsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ إضافة قناة", "admin:subs:add")
    .text("🗑 حذف قناة", "admin:subs:del")
    .row()
    .text("📋 القنوات", "admin:subs:list")
    .text("🔄 اختبار القنوات", "admin:subs:test")
    .row()
    .text("🔙 لوحة الأدمن", "admin:menu");
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 لوحة الأدمن", "admin:menu");
}

export function adminBroadcastKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📣 إرسال Broadcast", "admin:broadcast:start")
    .row()
    .text("🔙 لوحة الأدمن", "admin:menu");
}

export function adminSystemKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Check Updates", "admin:system:check")
    .row()
    .text("🔙 لوحة الأدمن", "admin:menu");
}