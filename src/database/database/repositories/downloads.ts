import { getDb } from "../database.js";
import type { DownloadRow, DownloadStatus, MediaType } from "../../types/index.js";

export const downloadsRepo = {
  create(input: {
    user_id: number;
    url: string;
    platform: string;
    media_type: MediaType;
  }): number {
    const r = getDb()
      .prepare(
        `INSERT INTO downloads (user_id, url, platform, media_type, status)
         VALUES (?, ?, ?, ?, 'queued')`,
      )
      .run(input.user_id, input.url, input.platform, input.media_type);
    return Number(r.lastInsertRowid);
  },

  update(id: number, data: Partial<DownloadRow>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (!fields.length) return;
    values.push(id);
    getDb().prepare(`UPDATE downloads SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  setStatus(id: number, status: DownloadStatus, error?: string | null): void {
    const ts =
      status === "processing" || status === "downloading" || status === "converting"
        ? "started_at = datetime('now')"
        : status === "completed" || status === "failed" || status === "cancelled"
          ? "completed_at = datetime('now')"
          : null;
    const sql = ts
      ? `UPDATE downloads SET status = ?, error_message = ?, ${ts} WHERE id = ?`
      : `UPDATE downloads SET status = ?, error_message = ? WHERE id = ?`;
    getDb().prepare(sql).run(status, error ?? null, id);
  },

  getByUser(userId: number, limit = 20): DownloadRow[] {
    return getDb()
      .prepare("SELECT * FROM downloads WHERE user_id = ? ORDER BY id DESC LIMIT ?")
      .all(userId, limit) as DownloadRow[];
  },

  countByStatus(status: DownloadStatus): number {
    const r = getDb()
      .prepare("SELECT COUNT(*) AS c FROM downloads WHERE status = ?")
      .get(status) as { c: number };
    return r.c;
  },

  countAll(): number {
    const r = getDb().prepare("SELECT COUNT(*) AS c FROM downloads").get() as { c: number };
    return r.c;
  },

  countByPlatform(platform: string): number {
    const r = getDb()
      .prepare(
        "SELECT COUNT(*) AS c FROM downloads WHERE platform = ? AND status = 'completed'",
      )
      .get(platform) as { c: number };
    return r.c;
  },

  countByMediaType(mediaType: MediaType): number {
    const r = getDb()
      .prepare(
        "SELECT COUNT(*) AS c FROM downloads WHERE media_type = ? AND status = 'completed'",
      )
      .get(mediaType) as { c: number };
    return r.c;
  },

  recentErrors(limit = 10): DownloadRow[] {
    return getDb()
      .prepare(
        "SELECT * FROM downloads WHERE status = 'failed' ORDER BY id DESC LIMIT ?",
      )
      .all(limit) as DownloadRow[];
  },

  recent(limit = 20): DownloadRow[] {
    return getDb()
      .prepare("SELECT * FROM downloads ORDER BY id DESC LIMIT ?")
      .all(limit) as DownloadRow[];
  },
};