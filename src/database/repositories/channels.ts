import { getDb } from "../database.js";
import type { ChannelRow } from "../../types/index.js";

export const channelsRepo = {
  list(): ChannelRow[] {
    return getDb()
      .prepare("SELECT * FROM force_subscription_channels ORDER BY id ASC")
      .all() as ChannelRow[];
  },

  listEnabled(): ChannelRow[] {
    return getDb()
      .prepare("SELECT * FROM force_subscription_channels WHERE enabled = 1 ORDER BY id ASC")
      .all() as ChannelRow[];
  },

  add(input: {
    chat_id: string;
    username?: string | null;
    invite_url: string;
    title: string;
  }): void {
    getDb()
      .prepare(
        `INSERT INTO force_subscription_channels (chat_id, username, invite_url, title)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET username = excluded.username, invite_url = excluded.invite_url, title = excluded.title`,
      )
      .run(input.chat_id, input.username ?? null, input.invite_url, input.title);
  },

  remove(chat_id: string): void {
    getDb()
      .prepare("DELETE FROM force_subscription_channels WHERE chat_id = ?")
      .run(chat_id);
  },

  toggle(chat_id: string, enabled: boolean): void {
    getDb()
      .prepare("UPDATE force_subscription_channels SET enabled = ? WHERE chat_id = ?")
      .run(enabled ? 1 : 0, chat_id);
  },
};