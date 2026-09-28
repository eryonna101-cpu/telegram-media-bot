import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const MAX_AGE_MIN = 30; // remove job dirs older than 30 min

export const cleanupService = {
  async runOnce(): Promise<number> {
    let removed = 0;
    let entries: string[] = [];
    try {
      entries = await fs.readdir(env.TEMP_DIR);
    } catch {
      return 0;
    }
    const now = Date.now();
    for (const entry of entries) {
      const p = path.join(env.TEMP_DIR, entry);
      try {
        const stat = await fs.stat(p);
        const ageMin = (now - stat.mtimeMs) / 60_000;
        if (ageMin > MAX_AGE_MIN) {
          await fs.rm(p, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // ignore
      }
    }
    if (removed > 0) logger.info({ removed }, "Cleanup removed stale dirs");
    return removed;
  },

  start(intervalMs = 5 * 60_000): NodeJS.Timeout {
    return setInterval(() => {
      this.runOnce().catch((e) => logger.warn({ err: (e as Error).message }, "cleanup error"));
    }, intervalMs);
  },
};