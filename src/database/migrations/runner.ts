import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        is_blocked INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        downloads_count INTEGER NOT NULL DEFAULT 0,
        successful_downloads INTEGER NOT NULL DEFAULT 0,
        failed_downloads INTEGER NOT NULL DEFAULT 0,
        audio_downloads INTEGER NOT NULL DEFAULT 0,
        video_downloads INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'other',
        media_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        file_size INTEGER,
        duration INTEGER,
        title TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_downloads_platform ON downloads(platform);

      CREATE TABLE IF NOT EXISTS force_subscription_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        username TEXT,
        invite_url TEXT NOT NULL,
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS blocked_users (
        telegram_id INTEGER PRIMARY KEY,
        blocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        total INTEGER NOT NULL DEFAULT 0,
        sent INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM _migrations").all().map((r: any) => r.id),
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    logger.info({ migration: m.id }, "Applying migration");
    db.exec(m.sql);
    db.prepare("INSERT INTO _migrations (id) VALUES (?)").run(m.id);
  }
}