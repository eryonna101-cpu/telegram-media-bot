import { getDb } from "../database.js";
import type { UserRow } from "../../types/index.js";

export const usersRepo = {
  upsert(input: {
    telegram_id: number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    language_code?: string | null;
    is_bot?: boolean;
  }): UserRow {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM users WHERE telegram_id = ?")
      .get(input.telegram_id) as UserRow | undefined;

    if (existing) {
      db.prepare(
        `UPDATE users
         SET username = ?, first_name = ?, last_name = ?, language_code = ?, last_seen_at = datetime('now')
         WHERE telegram_id = ?`,
      ).run(
        input.username ?? existing.username,
        input.first_name ?? existing.first_name,
        input.last_name ?? existing.last_name,
        input.language_code ?? existing.language_code,
        input.telegram_id,
      );
      return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(input.telegram_id) as UserRow;
    }

    db.prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_bot)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      input.telegram_id,
      input.username ?? null,
      input.first_name ?? null,
      input.last_name ?? null,
      input.language_code ?? null,
      input.is_bot ? 1 : 0,
    );
    return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(input.telegram_id) as UserRow;
  },

  getByTelegramId(telegram_id: number): UserRow | undefined {
    return getDb().prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegram_id) as
      | UserRow
      | undefined;
  },

  touch(telegram_id: number): void {
    getDb()
      .prepare("UPDATE users SET last_seen_at = datetime('now') WHERE telegram_id = ?")
      .run(telegram_id);
  },

  setBlocked(telegram_id: number, blocked: boolean, reason?: string): void {
    const db = getDb();
    if (blocked) {
      db.prepare(
        `INSERT INTO blocked_users (telegram_id, reason) VALUES (?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET reason = excluded.reason, blocked_at = datetime('now')`,
      ).run(telegram_id, reason ?? null);
      db.prepare("UPDATE users SET is_blocked = 1 WHERE telegram_id = ?").run(telegram_id);
    } else {
      db.prepare("DELETE FROM blocked_users WHERE telegram_id = ?").run(telegram_id);
      db.prepare("UPDATE users SET is_blocked = 0 WHERE telegram_id = ?").run(telegram_id);
    }
  },

  isBlocked(telegram_id: number): boolean {
    const row = getDb()
      .prepare("SELECT 1 FROM blocked_users WHERE telegram_id = ?")
      .get(telegram_id);
    return !!row;
  },

  list(limit = 50, offset = 0): UserRow[] {
    return getDb()
      .prepare("SELECT * FROM users ORDER BY joined_at DESC LIMIT ? OFFSET ?")
      .all(limit, offset) as UserRow[];
  },

  search(query: string): UserRow[] {
    const q = `%${query}%`;
    return getDb()
      .prepare(
        `SELECT * FROM users WHERE username LIKE ? OR CAST(telegram_id AS TEXT) LIKE ? OR first_name LIKE ? LIMIT 20`,
      )
      .all(q, q, q) as UserRow[];
  },

  listBlocked(): UserRow[] {
    return getDb()
      .prepare("SELECT * FROM users WHERE is_blocked = 1 ORDER BY joined_at DESC")
      .all() as UserRow[];
  },

  incrementDownload(telegram_id: number, success: boolean, mediaType: "video" | "audio"): void {
    const db = getDb();
    const col = mediaType === "video" ? "video_downloads" : "audio_downloads";
    db.prepare(
      `UPDATE users
       SET downloads_count = downloads_count + 1,
           successful_downloads = successful_downloads + ?,
           failed_downloads = failed_downloads + ?,
           ${col} = ${col} + 1
       WHERE telegram_id = ?`,
    ).run(success ? 1 : 0, success ? 0 : 1, telegram_id);
  },

  countAll(): number {
    const r = getDb().prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    return r.c;
  },

  countSince(dateIso: string): number {
    const r = getDb()
      .prepare("SELECT COUNT(*) AS c FROM users WHERE joined_at >= ?")
      .get(dateIso) as { c: number };
    return r.c;
  },

  activeSince(dateIso: string): number {
    const r = getDb()
      .prepare("SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ?")
      .get(dateIso) as { c: number };
    return r.c;
  },

  growth(days = 14): { day: string; count: number }[] {
    return getDb()
      .prepare(
        `SELECT date(joined_at) AS day, COUNT(*) AS count
         FROM users
         WHERE joined_at >= datetime('now', ?)
         GROUP BY day
         ORDER BY day ASC`,
      )
      .all(`-${days} days`) as { day: string; count: number }[];
  },

  allTelegramIds(): number[] {
    return getDb()
      .prepare("SELECT telegram_id FROM users WHERE is_blocked = 0")
      .all()
      .map((r: any) => r.telegram_id as number);
  },
};