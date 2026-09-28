import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { DownloadJob, MediaType, ProgressUpdate } from "../types/index.js";

interface EnqueueInput {
  userId: number;
  url: string;
  mediaType: MediaType;
  process: (job: DownloadJob, onProgress: (u: ProgressUpdate) => void) => Promise<{ filePath: string; fileSize: number; title: string; platform: string; duration: number }>;
}

interface QueueEntry {
  job: DownloadJob;
  input: EnqueueInput;
  resolve: (r: any) => void;
  reject: (e: Error) => void;
}

export class DownloadQueue extends EventEmitter {
  private queue: QueueEntry[] = [];
  private active = new Map<string, QueueEntry>();
  private userActive = new Map<number, number>(); // userId -> active count
  private userWindow = new Map<number, number[]>(); // userId -> timestamps
  private globalWindow: number[] = [];

  get position(): number {
    return this.queue.length;
  }

  getPosition(jobId: string): number {
    const idx = this.queue.findIndex((e) => e.job.id === jobId);
    return idx === -1 ? 0 : idx + 1;
  }

  cancel(jobId: string): boolean {
    const entry = this.active.get(jobId);
    if (entry) {
      entry.job.abort.abort();
      return true;
    }
    const idx = this.queue.findIndex((e) => e.job.id === jobId);
    if (idx !== -1) {
      const [removed] = this.queue.splice(idx, 1);
      removed.job.status = "cancelled";
      removed.reject(new Error("cancelled"));
      this.emit("cancelled", jobId);
      return true;
    }
    return false;
  }

  private rateAllow(userId: number): boolean {
    const now = Date.now();
    const minute = 60_000;

    // per-user
    const uw = (this.userWindow.get(userId) ?? []).filter((t) => now - t < minute);
    if (uw.length >= env.USER_RATE_LIMIT_PER_MIN) {
      this.userWindow.set(userId, uw);
      return false;
    }
    uw.push(now);
    this.userWindow.set(userId, uw);

    // global
    const gw = this.globalWindow.filter((t) => now - t < minute);
    if (gw.length >= env.GLOBAL_RATE_LIMIT_PER_MIN) {
      this.globalWindow = gw;
      return false;
    }
    gw.push(now);
    this.globalWindow = gw;
    return true;
  }

  enqueue(input: EnqueueInput): DownloadJob {
    const id = randomUUID();
    const abort = new AbortController();
    const job: DownloadJob = {
      id,
      userId: input.userId,
      url: input.url,
      mediaType: input.mediaType,
      status: "queued",
      position: 0,
      createdAt: Date.now(),
      abort,
    };

    const entry: QueueEntry = {
      job,
      input,
      resolve: () => {},
      reject: () => {},
    };

    this.queue.push(entry);
    job.position = this.queue.length;
    this.emit("queued", job);
    logger.info({ jobId: id, userId: input.userId }, "Job enqueued");
    this.tick();
    return job;
  }

  getJobPromise(jobId: string): Promise<any> | undefined {
    const entry =
      this.active.get(jobId) ?? this.queue.find((e) => e.job.id === jobId);
    return entry ? (entry as any)._promise : undefined;
  }

  private async tick(): Promise<void> {
    while (
      this.active.size < env.MAX_CONCURRENT_DOWNLOADS &&
      this.queue.length > 0
    ) {
      const entry = this.queue.shift()!;
      const { job, input } = entry;

      if ((this.userActive.get(job.userId) ?? 0) >= env.PER_USER_CONCURRENT) {
        // re-queue at the end if user already has an active job
        this.queue.push(entry);
        // avoid infinite loop if all remaining are same user
        if (this.queue.every((e) => e.job.userId === job.userId)) break;
        continue;
      }

      if (!this.rateAllow(job.userId)) {
        // re-queue, try later
        this.queue.push(entry);
        setTimeout(() => this.tick(), 1000);
        break;
      }

      this.active.set(job.id, entry);
      this.userActive.set(job.userId, (this.userActive.get(job.userId) ?? 0) + 1);
      job.status = "processing";
      this.emit("started", job);

      this.runJob(entry);
    }

    // update positions
    this.queue.forEach((e, i) => (e.job.position = i + 1));
  }

  private async runJob(entry: QueueEntry): Promise<void> {
    const { job, input } = entry;
    const onProgress = (u: ProgressUpdate) => {
      this.emit("progress", job.id, u);
    };
    try {
      const result = await input.process(job, onProgress);
      job.status = "completed";
      entry.resolve(result);
      this.emit("completed", job.id, result);
    } catch (err) {
      const e = err as Error;
      if (e.message === "cancelled" || job.abort.signal.aborted) {
        job.status = "cancelled";
        entry.reject(e);
        this.emit("cancelled", job.id);
      } else {
        job.status = "failed";
        entry.reject(e);
        this.emit("failed", job.id, e);
      }
    } finally {
      this.active.delete(job.id);
      this.userActive.set(job.userId, Math.max(0, (this.userActive.get(job.userId) ?? 0) - 1));
      this.tick();
    }
  }
}

export const downloadQueue = new DownloadQueue();