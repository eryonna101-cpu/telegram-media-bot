import { promises as fs } from "node:fs";
import path from "node:path";
import { detectAndExtract, PLATFORM_LABEL, PLATFORM_ICON } from "./detector.js";
import { downloadWithYtdlp } from "./ytdlp.js";
import { MAX_FILE_SIZE_BYTES, env } from "../config/env.js";
import { ensureDir, getFileSize } from "../utils/files.js";
import { logger } from "../utils/logger.js";
import { DownloadError } from "../utils/errors.js";
import type { DownloadResult, MediaInfo, MediaType, ProgressUpdate } from "../types/index.js";

export async function extractInfo(url: string, signal: AbortSignal): Promise<MediaInfo> {
  const info = await detectAndExtract(url, signal);
  return {
    title: info.title,
    duration: info.duration,
    filesize: info.filesize,
    platform: info.platform,
    extractor: info.extractor,
    thumbnail: info.thumbnail,
    uploader: info.uploader,
  };
}

export function formatInfoCard(info: MediaInfo): string {
  const durationStr = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}`
    : "—";
  const sizeStr = info.filesize ? `${(info.filesize / 1024 / 1024).toFixed(1)} MB` : "—";
  return [
    `🔗 تم التعرف على الرابط`,
    ``,
    `${PLATFORM_ICON[info.platform]} المنصة: ${PLATFORM_LABEL[info.platform]}`,
    `🎬 العنوان: ${info.title}`,
    `⏱️ المدة: ${durationStr}`,
    `📦 الحجم التقريبي: ${sizeStr}`,
    ``,
    `اختر الصيغة:`,
  ].join("\n");
}

export function estimateSizeOk(info: MediaInfo): boolean {
  if (info.filesize && info.filesize > MAX_FILE_SIZE_BYTES) return false;
  return true;
}

export async function processDownload(params: {
  url: string;
  mediaType: MediaType;
  outDir: string;
  signal: AbortSignal;
  onProgress?: (u: ProgressUpdate) => void;
}): Promise<DownloadResult> {
  const { url, mediaType, outDir, signal, onProgress } = params;

  await ensureDir(outDir);
  onProgress?.({ stage: "detecting", percent: 5, message: "جاري التعرف على الرابط..." });

  const info = await detectAndExtract(url, signal);
  if (info.filesize && info.filesize > MAX_FILE_SIZE_BYTES) {
    throw new DownloadError(
      `File too large: ${info.filesize} bytes`,
      "file_too_large",
    );
  }

  onProgress?.({ stage: "downloading", percent: 10, message: "⬇️ جاري التحميل..." });

  await downloadWithYtdlp({
    url,
    mediaType,
    outDir,
    signal,
    onProgress: (percent) => {
      // map 0..100 download to 10..80
      const mapped = 10 + Math.min(90, percent) * 0.7;
      onProgress?.({ stage: "downloading", percent: Math.round(mapped), message: "⬇️ جاري التحميل..." });
    },
  });

  // Find produced file in outDir
  const files = await fs.readdir(outDir);
  const mediaFile = files.find((f) => /\.(mp4|webm|mkv|mp3|m4a)$/i.test(f));
  if (!mediaFile) {
    throw new DownloadError("Output file not found after download", "no_output");
  }
  const filePath = path.join(outDir, mediaFile);

  onProgress?.({ stage: "converting", percent: 85, message: "⚙️ جاري معالجة الملف..." });

  const fileSize = await getFileSize(filePath);
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new DownloadError(
      `Resulting file too large: ${fileSize} bytes (limit ${MAX_FILE_SIZE_BYTES})`,
      "file_too_large",
    );
  }

  onProgress?.({ stage: "sending", percent: 95, message: "📤 جاري الإرسال..." });

  return {
    filePath,
    title: info.title,
    platform: info.platform,
    duration: info.duration,
    fileSize,
    mediaType,
  };
}

export { PLATFORM_LABEL, PLATFORM_ICON };