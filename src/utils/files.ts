import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export function createJobDir(jobId?: string): { jobId: string; dir: string } {
  const id = jobId ?? randomUUID();
  const dir = path.join(env.TEMP_DIR, id);
  return { jobId: id, dir };
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function cleanupPath(target: string): Promise<void> {
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(p: string): Promise<number> {
  const stat = await fs.stat(p);
  return stat.size;
}

export async function ensureBaseDirs(): Promise<void> {
  await fs.mkdir(env.TEMP_DIR, { recursive: true });
  await fs.mkdir(env.DATA_DIR, { recursive: true });
}