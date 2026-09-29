import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import fs from "node:fs";
import path from "node:path";

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

export async function downloadWithYtdlp(opts: DownloadOptions): Promise<YtdlpResult> {
  const { url, mediaType, outDir, signal } = opts;

  logger.info({ url, mediaType }, "Starting download via Cobalt API");

  // استخدام سيرفر Cobalt العام (أو يمكنك استبداله برابط سيرفرك الخاص إذا كنت حاسبه)
  const cobaltApiUrl = "https://api.cobalt.tools/api/json";

  const response = await fetch(cobaltApiUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: url,
      vQuality: "720",
      audioFormat: mediaType === "audio" ? "mp3" : "best",
      isAudioOnly: mediaType === "audio"
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Cobalt API failed with status ${response.status}`);
  }

  const data: any = await response.json();

  if (data.status === "error" || !data.url) {
    throw new Error(data.text || "Failed to fetch media from Cobalt API");
  }

  const mediaUrl = data.url;
  const fileName = `media_${Date.now()}.${mediaType === "audio" ? "mp3" : "mp4"}`;
  const filePath = path.join(outDir, fileName);

  // تحميل الملف المباشر إلى المجلد المؤقت
  const fileResponse = await fetch(mediaUrl, { signal });
  if (!fileResponse.ok || !fileResponse.body) {
    throw new Error("Failed to download media file from direct URL");
  }

  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const stats = fs.statSync(filePath);

  return {
    filePath: filePath,
    title: data.filename || "media",
    fileSize: stats.size || 0,
    duration: 0,
    platform: "cobalt"
  };
}

export async function getYtdlpVersion(): Promise<string> {
  return "cobalt-api-v2";
}

export async function checkYtdlpUpdate() {
  return { current: "cobalt", latest: "cobalt", updateAvailable: false };
}

export async function updateYtdlp(): Promise<string> {
  return "cobalt";
}
