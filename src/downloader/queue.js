import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/files.js";

export class CancelledError extends Error {
  constructor(message = "cancelled") {
    super(message);
    this.name = "CancelledError";
    this.cancelled = true;
  }
}

// طابور تحميل: تحكم بالتزامن + مهلة لكل عملية + إعادة محاولة محدودة + إلغاء
export class TaskQueue {
  constructor(limit = 1) {
    this.limit = Math.max(1, limit);
    this.active = 0;
    this.waiting = [];
    this.jobs = new Map(); // jobId -> { controller, cancelled }
  }

  get stats() {
    return { active: this.active, pending: this.waiting.length, limit: this.limit };
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.cancelled = true;
      job.controller.abort();
    }
  }

  _acquire() {
    return new Promise((resolve) => {
      if (this.active < this.limit) {
        this.active++;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  _release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiting.shift();
    if (next) {
      this.active++;
      next();
    }
  }

  async run(jobId, task, { timeoutMs = 300000, retries = 0 } = {}) {
    const job = { controller: new AbortController(), cancelled: false };
    this.jobs.set(jobId, job);
    try {
      await this._acquire();
      const attempts = retries + 1;
      let lastError;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (job.cancelled) throw new CancelledError();
        if (attempt > 1) await sleep(2000 * (attempt - 1));
        const timer = setTimeout(() => job.controller.abort(), timeoutMs);
        try {
          return await task(job.controller.signal);
        } catch (err) {
          if (job.cancelled) throw new CancelledError();
          lastError = err;
          logger.warn(`job ${jobId}: attempt ${attempt}/${attempts} failed: ${String(err.message).slice(0, 200)}`);
        } finally {
          clearTimeout(timer);
          job.controller = new AbortController();
        }
      }
      throw lastError;
    } finally {
      this.jobs.delete(jobId);
      this._release();
    }
  }
}

export const downloadQueue = new TaskQueue(config.maxConcurrentDownloads);