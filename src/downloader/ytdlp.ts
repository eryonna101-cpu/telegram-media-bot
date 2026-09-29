import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import fs from "node:fs";
import path from "node:path";

export function getYtdlpVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.YTDLP_BIN, ["--version"]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("Failed to get version"));
      resolve(out.trim().split("\n")[0]);
    });
  });
}

export interface DownloadOptions {
  url: string;
  mediaType: "video" | "audio";
  outDir: string;
  signal: AbortSignal;
  onProgress?: (percent: number, speed: string) => void;
}

export interface YtdlpResult {
  filePath: string;
  title: string;
  fileSize: number;
  duration: number;
  platform: string;
}

export function downloadWithYtdlp(opts: DownloadOptions): Promise<YtdlpResult> {
  return new Promise((resolve, reject) => {
    const { url, mediaType, outDir, signal } = opts;
    const outTemplate = path.join(outDir, "%(id)s.%(ext)s");

    const args: string[] = [
      "--no-playlist",
      "--no-warnings",
      "--newline",
      "--print-json",
      "-o",
      outTemplate,
    ];

    if (mediaType === "audio") {
      args.push("-x", "--audio-format", "mp3");
    } else {
      args.push("-f", "bv*+ba/b", "--merge-output-format", "mp4");
    }

    args.push(url);

    logger.info({ mediaType, outDir }, "Starting yt-dlp download");

    const proc = spawn(env.YTDLP_BIN, args, { signal });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("error", (err) => reject(err));

    proc.on("close", (code) => {
      if (signal.aborted) return reject(new Error("Aborted"));
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp failed with code ${code}`));
      }

      try {
        const lines = stdout.trim().split("\n");
        let meta: any = {};
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.title) meta = parsed;
          } catch {}
        }

        fs.readdir(outDir, (err, files) => {
          if (err || files.length === 0) {
            return reject(new Error("Downloaded file not found in output directory"));
          }
          
          const downloadedFile = path.join(outDir, files[0]);
          const stats = fs.statSync(downloadedFile);

          resolve({
            filePath: downloadedFile,
            title: meta.title || path.parse(files[0]).name,
            fileSize: stats.size || 0,
            duration: meta.duration || 0,
            platform: meta.extractor || "ytdlp",
          });
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function checkYtdlpUpdate() {
  const current = await getYtdlpVersion();
  return { current, latest: current, updateAvailable: false };
}

export async function updateYtdlp(): Promise<string> {
  return await getYtdlpVersion();
}
