import type { Bot, Context, Next } from "grammy";
import { env } from "../../config/env.js";
import { isOwner } from "../middleware/auth.js";
import { statisticsService } from "../../services/statistics.js";
import { systemInfoService } from "../../services/systemInfo.js";
import { broadcastService } from "../../services/broadcast.js";
import { usersRepo } from "../../database/repositories/users.js";
import { downloadsRepo } from "../../database/repositories/downloads.js";
import { channelsRepo } from "../../database/repositories/channels.js";
import { adminActionsRepo, broadcastsRepo } from "../../database/repositories/settings.js";
import { PLATFORM_LABEL } from "../../downloader/detector.js";
import { downloadQueue } from "../../downloader/queue.js";
import { adminStates, AdminState } from "../states/adminStates.js";
import {
  adminMenuKeyboard,
  adminStatsKeyboard,
  adminUsersKeyboard,
  adminSubsKeyboard,
  adminBackKeyboard,
  adminBroadcastKeyboard,
  adminSystemKeyboard,
} from "../keyboards/admin.js";
import { logger } from "../../utils/logger.js";

function unauthorizedText(): string {
  return "🚫 غير مصرح لك.";
}

function adminMenuText(): string {
  return [
    `⚙️ لوحة الأدمن`,
    `────────────`,
    `• 📊 الإحصائيات`,
    `• 👥 المستخدمون`,
    `• 📥 التحميلات`,
    `• 📢 الاشتراك الإجباري`,
    `• 📣 Broadcast`,
    `• 🚫 الحظر`,
    `• ⚙️ إعدادات`,
    `• 🧰 النظام`,
    `• 📝 Logs`,
  ].join("\n");
}

export function registerAdmin(bot: Bot): void {
  // Menu
  bot.callbackQuery("admin:menu", async (ctx: Context) => {
    if (!isOwner(ctx)) {
      await ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
      return;
    }
    adminStates.clear(ctx.from!.id);
    await ctx.editMessageText(adminMenuText(), { reply_markup: adminMenuKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Stats
  bot.callbackQuery("admin:stats", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const s = statisticsService.getAdminStats();
    const text = [
      `📊 الإحصائيات`,
      `────────────`,
      `👥 Users`,
      `────────────`,
      `Total: ${s.users.total}`,
      `Today: ${s.users.today}`,
      `This Week: ${s.users.week}`,
      `This Month: ${s.users.month}`,
      `Active (week): ${s.users.activeWeek}`,
      ``,
      `📥 Downloads`,
      `────────────`,
      `Total: ${s.downloads.total}`,
      `Successful: ${s.downloads.successful}`,
      `Failed: ${s.downloads.failed}`,
      `🎬 Video: ${s.downloads.video}`,
      `🎵 MP3: ${s.downloads.audio}`,
      ``,
      `📱 Platforms`,
      `────────────`,
      ...Object.entries(s.platforms)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${PLATFORM_LABEL[k as keyof typeof PLATFORM_LABEL] ?? k}: ${v}`),
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: adminStatsKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Users menu
  bot.callbackQuery("admin:users", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    await ctx.editMessageText("👥 إدارة المستخدمين", { reply_markup: adminUsersKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:users:all", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const users = usersRepo.list(15, 0);
    const lines = ["👥 آخر المستخدمين", "────────────"];
    for (const u of users) {
      lines.push(`• ${u.username ? "@" + u.username : u.telegram_id} — 📥${u.downloads_count} 🚫${u.is_blocked}`);
    }
    lines.push("", `الإجمالي: ${usersRepo.countAll()}`);
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:users:blocked", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const users = usersRepo.listBlocked();
    const lines = ["🚫 المحظورون", "────────────"];
    for (const u of users) lines.push(`• ${u.username ? "@" + u.username : u.telegram_id}`);
    if (!users.length) lines.push("لا يوجد محظورون.");
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:users:search", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    adminStates.set(ctx.from!.id, AdminState.SEARCH_WAIT_QUERY);
    await ctx.editMessageText("🔎 أرسل username أو Telegram ID للبحث.", { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Downloads
  bot.callbackQuery("admin:downloads", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const recent = downloadsRepo.recent(15);
    const lines = ["📥 آخر التحميلات", "────────────"];
    for (const d of recent) {
      lines.push(`• #${d.id} [${d.status}] ${d.platform} — ${d.media_type}`);
    }
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Subscription management
  bot.callbackQuery("admin:subs", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    await ctx.editMessageText("📢 الاشتراك الإجباري", { reply_markup: adminSubsKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:subs:list", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const channels = channelsRepo.list();
    const lines = ["📋 القنوات", "────────────"];
    if (!channels.length) lines.push("لا توجد قنوات.");
    for (const c of channels) lines.push(`• ${c.title} (${c.enabled ? "✅" : "⛔"}) ${c.invite_url}`);
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:subs:add", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    adminStates.set(ctx.from!.id, AdminState.ADD_CHANNEL_WAIT_CHAT);
    await ctx.editMessageText(
      "➕ أرسل بيانات القناة بهذا الشكل:\n\n@channel_username https://t.me/+invite عنوان القناة\n\nأو أرسل invite link فقط.",
      { reply_markup: adminBackKeyboard() },
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:subs:del", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const channels = channelsRepo.list();
    if (!channels.length) {
      await ctx.answerCallbackQuery({ text: "لا توجد قنوات." });
      return;
    }
    const lines = ["🗑 أرسل chat_id أو @username للقناة المراد حذفها:", "────────────"];
    for (const c of channels) lines.push(`• ${c.chat_id} — ${c.title}`);
    adminStates.set(ctx.from!.id, "del_channel_wait");
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:subs:test", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const channels = channelsRepo.listEnabled();
    let ok = 0;
    for (const c of channels) {
      try {
        await bot.api.getChat(c.chat_id);
        ok++;
      } catch (e) {
        logger.warn({ chatId: c.chat_id, err: (e as Error).message }, "Channel test failed");
      }
    }
    await ctx.editMessageText(
      `🔄 اختبار القنوات\n────────────\n✅ صالحة: ${ok}/${channels.length}`,
      { reply_markup: adminBackKeyboard() },
    );
    await ctx.answerCallbackQuery();
  });

  // Broadcast
  bot.callbackQuery("admin:broadcast", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const recent = broadcastsRepo.recent(5);
    const lines = ["📣 Broadcast", "────────────"];
    for (const b of recent) lines.push(`• #${b.id} → sent ${b.sent}/${b.total} (failed ${b.failed})`);
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBroadcastKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin:broadcast:start", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    adminStates.set(ctx.from!.id, AdminState.BROADCAST_WAIT_TEXT);
    await ctx.editMessageText("✏️ أرسل الرسالة الآن (نص/HTML).", { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Blocked management (list + inline block/unblock handled via text search)
  bot.callbackQuery("admin:blocked", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const users = usersRepo.listBlocked();
    const lines = ["🚫 المحظورون", "────────────"];
    if (!users.length) lines.push("لا يوجد محظورون.");
    for (const u of users) lines.push(`• ${u.username ? "@" + u.username : u.telegram_id} — /unblock_${u.telegram_id}`);
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Settings
  bot.callbackQuery("admin:settings", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const text = [
      `⚙️ الإعدادات`,
      `────────────`,
      `• MAX_FILE_SIZE_MB: ${env.MAX_FILE_SIZE_MB}`,
      `• MAX_CONCURRENT_DOWNLOADS: ${env.MAX_CONCURRENT_DOWNLOADS}`,
      `• DOWNLOAD_TIMEOUT_SECONDS: ${env.DOWNLOAD_TIMEOUT_SECONDS}`,
      `• FORCE_SUBSCRIPTION_ENABLED: ${env.FORCE_SUBSCRIPTION_ENABLED}`,
      `• YTDLP_UPDATE_CHANNEL: ${env.YTDLP_UPDATE_CHANNEL}`,
      `• USER_RATE_LIMIT_PER_MIN: ${env.USER_RATE_LIMIT_PER_MIN}`,
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // System
  bot.callbackQuery("admin:system", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    await ctx.answerCallbackQuery({ text: "جاري القراءة..." });
    const v = await systemInfoService.versions();
    const text = [
      `🧰 النظام`,
      `────────────`,
      `yt-dlp: ${v.ytdlp}`,
      `FFmpeg: ${v.ffmpeg}`,
      `Node.js: ${v.node}`,
      ``,
      `Queue: ${downloadQueue ? "active" : "—"}`,
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: adminSystemKeyboard() });
  });

  bot.callbackQuery("admin:system:check", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    await ctx.answerCallbackQuery({ text: "جاري الفحص..." });
    const status = await systemInfoService.updateStatus();
    const text = [
      `🔄 فحص التحديثات`,
      `────────────`,
      `الإصدار الحالي: ${status.current}`,
      `الأحدث: ${status.latest}`,
      status.updateAvailable ? "✅ يوجد تحديث متاح (سيُطبّق عند إعادة البناء)." : "✔️ محدّث.",
    ].join("\n");
    await ctx.editMessageText(text, { reply_markup: adminSystemKeyboard() });
  });

  // Logs
  bot.callbackQuery("admin:logs", async (ctx: Context) => {
    if (!isOwner(ctx)) return ctx.answerCallbackQuery({ text: unauthorizedText(), show_alert: true });
    const errors = downloadsRepo.recentErrors(10);
    const actions = adminActionsRepo.recent(10);
    const lines = ["📝 آخر الأخطاء", "────────────"];
    if (!errors.length) lines.push("لا أخطاء حديثة.");
    for (const e of errors) lines.push(`• #${e.id} ${e.platform}: ${e.error_message?.slice(0, 60)}`);
    lines.push("", "📝 آخر إجراءات الأدمن", "────────────");
    for (const a of actions) lines.push(`• ${a.action} ${a.target ?? ""}`);
    await ctx.editMessageText(lines.join("\n"), { reply_markup: adminBackKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // ── Conversation state text handler ──
  bot.on("message:text", async (ctx: Context, next: Next) => {
    if (!isOwner(ctx)) return next();
    const state = adminStates.get(ctx.from!.id);
    if (!state) return next();

    const text = ctx.message.text;

    if (state.state === AdminState.ADD_CHANNEL_WAIT_CHAT) {
      adminStates.clear(ctx.from!.id);
      // parse: "@username https://t.me/... Title" or just invite link
      const parts = text.trim().split(/\s+/);
      let username: string | null = null;
      let inviteUrl = "";
      let title = "قناة";
      if (parts[0]?.startsWith("@")) {
        username = parts[0].slice(1);
        inviteUrl = parts[1] ?? `https://t.me/${username}`;
        title = parts.slice(2).join(" ") || `@${username}`;
      } else if (parts[0]?.startsWith("http")) {
        inviteUrl = parts[0];
        title = parts.slice(1).join(" ") || "قناة";
      } else {
        await ctx.reply("❌ صيغة غير صالحة. استخدم: @username https://t.me/... عنوان");
        return;
      }
      // resolve chat id via bot
      try {
        const chat = await bot.api.getChat(username ? `@${username}` : inviteUrl);
        channelsRepo.add({
          chat_id: String(chat.id),
          username: (chat as any).username ?? username,
          invite_url: inviteUrl,
          title: chat.title ?? title,
        });
        adminActionsRepo.log(ctx.from!.id, "add_channel", String(chat.id));
        await ctx.reply(`✅ تمت إضافة القناة: ${chat.title ?? title}`);
      } catch (e) {
        await ctx.reply(`❌ تعذر الوصول للقناة. تأكد أن البوت أدمن فيها.\n${(e as Error).message}`);
      }
      return;
    }

    if (state.state === "del_channel_wait") {
      adminStates.clear(ctx.from!.id);
      const q = text.trim();
      const channels = channelsRepo.list();
      const target = channels.find((c) => c.chat_id === q || (c.username && c.username === q.replace("@", "")));
      if (!target) {
        await ctx.reply("❌ لم يتم العثور على القناة.");
        return;
      }
      channelsRepo.remove(target.chat_id);
      adminActionsRepo.log(ctx.from!.id, "del_channel", target.chat_id);
      await ctx.reply(`🗑 تم حذف القناة: ${target.title}`);
      return;
    }

    if (state.state === AdminState.SEARCH_WAIT_QUERY) {
      adminStates.clear(ctx.from!.id);
      const results = usersRepo.search(q(text));
      const lines = ["🔎 نتائج البحث", "────────────"];
      if (!results.length) lines.push("لا نتائج.");
      for (const u of results) {
        lines.push(`• ${u.username ? "@" + u.username : u.telegram_id}`);
        lines.push(`  📥 ${u.downloads_count} | ✅ ${u.successful_downloads} | ❌ ${u.failed_downloads}`);
        lines.push(`  /block ${u.telegram_id}   /unblock ${u.telegram_id}`);
      }
      await ctx.reply(lines.join("\n"));
      return;
    }

    if (state.state === AdminState.BROADCAST_WAIT_TEXT) {
      adminStates.set(ctx.from!.id, AdminState.BROADCAST_CONFIRM, { text });
      await ctx.reply(
        `✏️ رسالتك:\n────────────\n${text}\n────────────\nأرسل "تأكيد" للإرسال أو "إلغاء".`,
      );
      return;
    }

    if (state.state === AdminState.BROADCAST_CONFIRM) {
      if (text.trim() === "تأكيد") {
        adminStates.clear(ctx.from!.id);
        const msg = state.data.text as string;
        await ctx.reply("📣 جاري إرسال البرودكاست...");
        await broadcastService.send(bot, ctx.from!.id, msg);
        await ctx.reply("✅ تم الإرسال.");
      } else {
        adminStates.clear(ctx.from!.id);
        await ctx.reply("❌ تم إلغاء البرودكاست.");
      }
      return;
    }

    return next();
  });

  // Block / unblock commands
  bot.command("block", async (ctx: Context) => {
    if (!isOwner(ctx)) return;
    const arg = ctx.match;
    if (!arg) return ctx.reply("الاستخدام: /block <telegram_id>");
    const tid = Number(arg);
    if (!Number.isInteger(tid)) return ctx.reply("ID غير صالح.");
    usersRepo.setBlocked(tid, true, "manual");
    adminActionsRepo.log(ctx.from!.id, "block", String(tid));
    await ctx.reply(`🚫 تم حظر ${tid}`);
  });

  bot.command("unblock", async (ctx: Context) => {
    if (!isOwner(ctx)) return;
    const arg = ctx.match;
    if (!arg) return ctx.reply("الاستخدام: /unblock <telegram_id>");
    const tid = Number(arg);
    if (!Number.isInteger(tid)) return ctx.reply("ID غير صالح.");
    usersRepo.setBlocked(tid, false);
    adminActionsRepo.log(ctx.from!.id, "unblock", String(tid));
    await ctx.reply(`✅ تم فك الحظر عن ${tid}`);
  });
}

function q(s: string): string {
  return s;
}