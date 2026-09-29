import { logger } from "../utils/logger.js";
import { session } from "../utils/session.js";
import { extractUrl, detectPlatform, platformLabel } from "../utils/links.js";
import { probe } from "../services/downloader.js";
import { confirmKeyboard } from "../keyboards/download.js";
import {
  allUserIds,
  blockUser,
  unblockUser,
} from "../database/models.js";
import { fmtBytes, fmtDuration, escapeHtml, sleep } from "../utils/files.js";

// موجّه الرسائل النصية حسب حالة الجلسة (رابط / بث / حظر / فك حظر)
export function registerMessageRouter(bot) {
  bot.on("message:text", async (ctx) => {
    const s = session.get(ctx.from.id);
    if (!s?.waitingFor) return;
    const text = ctx.message.text.trim();
    switch (s.waitingFor) {
      case "link":
        return handleLink(ctx, text);
      case "broadcast":
        return handleBroadcast(ctx);
      case "ban":
        return handleBan(ctx, text);
      case "unban":
        return handleUnban(ctx, text);
      default:
        return;
    }
  });

  bot.on("message", async (ctx) => {
    const s = session.get(ctx.from.id);
    if (!s?.waitingFor) return;
    if (s.waitingFor === "broadcast") return handleBroadcast(ctx);
    if (s.waitingFor === "link") {
      await ctx.reply("⚠️ أرسل الرابط كنص، من فضلك.");
    }
  });
}

async function handleLink(ctx, text) {
  const url = extractUrl(text) || (/^https?:\/\//i.test(text) ? text : null);
  const platform = url ? detectPlatform(url) : null;
  if (!platform) {
    await ctx.reply("⚠️ هذا الرابط غير مدعوم.\n\nأرسل رابط فيديو صحيح من TikTok أو Instagram.");
    return;
  }
  session.update(ctx.from.id, { waitingFor: null, url, platform });
  const waitMsg = await ctx.reply("🔎 جاري فحص الرابط…");
  const info = await probe(url).catch(() => null);
  try {
    await ctx.deleteMessage(waitMsg.message_id);
  } catch {
    /* ignore */
  }
  const lines = ["🔗 الرابط:", platformLabel(platform), ""];
  if (info) {
    if (info.title) lines.push(`📄 العنوان: ${escapeHtml(info.title)}`);
    if (info.duration) lines.push(`⏱️ المدة: ${fmtDuration(info.duration)}`);
    if (info.filesize) lines.push(`📦 الحجم التقريبي: ${fmtBytes(info.filesize)}`);
  }
  session.update(ctx.from.id, { info });
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: confirmKeyboard(),
  });
}

async function handleBroadcast(ctx) {
  session.update(ctx.from.id, { waitingFor: null });
  const status = await ctx.reply("📢 جاري إرسال الرسالة لجميع المستخدمات…");
  const ids = allUserIds();
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await ctx.api.copyMessage(id, ctx.chat.id, ctx.message.message_id);
      ok++;
    } catch {
      failed++;
    }
    if ((ok + failed) % 20 === 0) await sleep(1000); // احترام حدود تيليجرام
  }
  await ctx.api.editMessageText(
    ctx.chat.id,
    status.message_id,
    `📢 تم الإرسال إلى ${ok} مستخدم${failed ? ` (فشل: ${failed})` : ""}.`
  );
  logger.info("broadcast completed", { total: ids.length, ok, failed });
}

async function handleBan(ctx, text) {
  const id = parseInt(text.replace(/\D/g, ""), 10);
  if (!id) {
    await ctx.reply("⚠️ أرسل Telegram ID صحيحًا (أرقام فقط).");
    return;
  }
  session.update(ctx.from.id, { waitingFor: null });
  blockUser(id, "banned by owner");
  await ctx.reply(`🚫 تم حظر المستخدم ${id}.`);
  logger.warn("user blocked", { target: id, by: ctx.from.id });
}

async function handleUnban(ctx, text) {
  const id = parseInt(text.replace(/\D/g, ""), 10);
  if (!id) {
    await ctx.reply("⚠️ أرسل Telegram ID صحيحًا (أرقام فقط).");
    return;
  }
  session.update(ctx.from.id, { waitingFor: null });
  unblockUser(id);
  await ctx.reply(`✅ تم فك الحظر عن ${id}.`);
  logger.info("user unblocked", { target: id, by: ctx.from.id });
}