import { getDb } from "../database.js";

export const settingsRepo = {
  get(key: string, fallback: string | null = null): string | null {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? fallback;
  },

  set(key: string, value: string): void {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  },

  all(): Record<string, string> {
    const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
};

export const adminActionsRepo = {
  log(admin_id: number, action: string, target?: string | null, details?: string | null): void {
    getDb()
      .prepare(
        "INSERT INTO admin_actions (admin_id, action, target, details) VALUES (?, ?, ?, ?)",
      )
      .run(admin_id, action, target ?? null, details ?? null);
  },

  recent(limit = 20): { id: number; admin_id: number; action: string; target: string | null; details: string | null; created_at: string }[] {
    return getDb()
      .prepare("SELECT * FROM admin_actions ORDER BY id DESC LIMIT ?")
      .all(limit) as any;
  },
};

export const broadcastsRepo = {
  create(admin_id: number, text: string, total: number): number {
    const r = getDb()
      .prepare(
        "INSERT INTO broadcasts (admin_id, text, total) VALUES (?, ?, ?)",
      )
      .run(admin_id, text, total);
    return Number(r.lastInsertRowid);
  },
  markSent(id: number, sent: number, failed: number): void {
    getDb()
      .prepare(
        "UPDATE broadcasts SET sent = ?, failed = ?, completed_at = datetime('now') WHERE id = ?",
      )
      .run(sent, failed, id);
  },
  recent(limit = 10): any[] {
    return getDb()
      .prepare("SELECT * FROM broadcasts ORDER BY id DESC LIMIT ?")
      .all(limit) as any[];
  },
};