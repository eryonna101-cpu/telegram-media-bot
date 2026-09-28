import { InlineKeyboard } from "grammy";
import { channelsRepo } from "../../database/repositories/channels.js";
import type { ChannelRow } from "../../types/index.js";

export function subscriptionKeyboard(channels: ChannelRow[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const ch of channels) {
    kb.text(`🔗 ${ch.title}`, ch.invite_url).row();
  }
  kb.text("✅ تحققت من الاشتراك", "sub:check");
  return kb;
}

export function retrySubKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔄 تحقق مرة أخرى", "sub:check");
}

export function buildSubscriptionMessage(channels: ChannelRow[]): string {
  const lines = ["📢 يجب الاشتراك بالقنوات التالية:", ""];
  for (const ch of channels) lines.push(`• ${ch.title}`);
  lines.push("", "بعد الاشتراك اضغط ✅ تحققت من الاشتراك.");
  return lines.join("\n");
}

export function getEnabledChannels(): ChannelRow[] {
  return channelsRepo.listEnabled();
}