import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function getYtdlpVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.YTDLP_BIN, ["--version"], { windowsHide: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("yt-dlp version failed"));
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
}

export function downloadWithYtdlp(opts: DownloadOptions): Promise<YtdlpResult> {
  return new Promise((resolve, reject) => {
    const { url, mediaType, outDir, signal, onProgress } = opts;

    const outTemplate = `${outDir}/%(title).80s.%(ext)s`;

    const args: string[] = [
      "--no-playlist",
      "--no-warnings",
      "--newline",
      "-o",
      outTemplate,
    ];

    if (mediaType === "audio") {
      args.push("-x", "--audio-format", "mp3", "--audio-quality", "0", "--embed-metadata");
    } else {
      args.push("-f", "best[ext=mp4][filesize<=2000M]/best[ext=webm]/best", "--merge-output-format", "mp4");
    }

    args.push(url);

    logger.info({ mediaType, outDir }, "Starting yt-dlp download");

    const proc = spawn(env.YTDLP_BIN, args, { signal, windowsHide: true });
    let stderr = "";
    let title = "media";

    const handleOut = (d: Buffer) => {
      const text = d.toString();
      const m = text.match(/\[download\]\s+([\d.]+)%/);
      if (m && onProgress) onProgress(Number(m[1]), "");
      const t = text.match(/\[download\] Destination: (.+)/);
      if (t) title = t[1].trim();
    };
    proc.stdout?.on("data", handleOut);
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
      handleOut(d);
    });

    proc.on("error", (err) => reject(err));

    proc.on("close", (code) => {
      if (signal.aborted) return reject(new Error("cancelled"));
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
      // The actual filename is hard to predict exactly; yt-dlp prints destination.
      // We resolve by scanning outDir for the produced file.
      resolve({ filePath: "", title });
    });
  });
}

export async function checkYtdlpUpdate(): Promise<{ current: string; latest: string; updateAvailable: boolean }> {
  const current = await getYtdlpVersion();
  const latest = await new Promise<string>((resolve, reject) => {
    const proc = spawn(env.YTDLP_BIN, ["--version", "--update-to", "stable"], { windowsHide: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", reject);
    proc.on("close", () => resolve(out.trim().split("\n")[0] || current));
  });
  return {
    current,
    latest,
    updateAvailable: current !== latest,
  };
}

export function updateYtdlp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = env.YTDLP_UPDATE_CHANNEL === "nightly" ? "nightly" : "stable";
    const proc = spawn(env.YTDLP_BIN, ["-U", "--update-to", target], { windowsHide: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(out.trim()))));
  });
}