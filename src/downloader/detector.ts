import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { PlatformName } from "../types/index.js";

const EXTRACTOR_MAP: Record<string, PlatformName> = {
  youtube: "youtube",
  youtubemusic: "youtube",
  tiktok: "tiktok",
  tiktokuser: "tiktok",
  instagram: "instagram",
  facebook: "facebook",
  twitter: "twitter",
  x: "twitter",
  vimeo: "vimeo",
  dailymotion: "dailymotion",
  soundcloud: "soundcloud",
  twitch: "twitch",
  twitchclips: "twitch",
  twitchstream: "twitch",
  twitchvideoseries: "twitch",
  twitchvideo: "twitch",
  reddit: "other",
  bilibili: "other",
  dailymail: "other",
};

export function mapExtractor(extractor: string): PlatformName {
  if (!extractor) return "other";
  const key = extractor.toLowerCase();
  
  for (const [k, v] of Object.entries(EXTRACTOR_MAP)) {
    if (key === k || key.startsWith(k) || key.includes(k)) return v;
  }
  
  // مطابقة احتياطية ذكية وشاملة لمنع ظهور خطأ المنصة غير المعروفة
  if (key.includes("youtube") || key.includes("youtu")) return "youtube";
  if (key.includes("tiktok")) return "tiktok";
  if (key.includes("instagram") || key.includes("ig")) return "instagram";
  if (key.includes("facebook") || key.includes("fb")) return "facebook";
  if (key.includes("twitter") || key.includes("x.com")) return "twitter";
  
  return "other";
}

export const PLATFORM_LABEL: Record<PlatformName, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  soundcloud: "SoundCloud",
  twitch: "Twitch",
  other: "Other",
};

export const PLATFORM_ICON: Record<PlatformName, string> = {
  youtube: "▶️",
  tiktok: "📱",
  instagram: "📸",
  facebook: "📘",
  twitter: "🐦",
  vimeo: "🎬",
  dailymotion: "📹",
  soundcloud: "☁️",
  twitch: "🎮",
  other: "🌐",
};

function runYtdlpJson(url: string, signal: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ["--dump-json", "--no-playlist", url];
    const proc = spawn(env.YTDLP_BIN, args, { signal });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error("Failed to parse yt-dlp json output"));
      }
    });
  });
}

export async function detectAndExtract(
  url: string,
  signal: AbortSignal,
): Promise<{
  platform: PlatformName;
  extractor: string;
  title: string;
  duration: number;
  filesize: number | null;
  thumbnail: string | null;
  uploader: string | null;
}> {
  logger.debug({ url }, "Detecting media info");
  const info = await runYtdlpJson(url, signal);
  const extractor: string = info.extractor_key || info.extractor || "unknown";
  const platform = mapExtractor(extractor);

  let filesize: number | null = null;
  if (typeof info.filesize === "number") filesize = info.filesize;
  else if (info.filesize_approx) filesize = Math.floor(info.filesize_approx);
  else if (Array.isArray(info.formats) && info.formats.length > 0) {
    const f = info.formats[info.formats.length - 1];
    if (f?.filesize) filesize = f.filesize;
    else if (f?.filesize_approx) filesize = Math.floor(f.filesize_approx);
  }

  return {
    platform,
    extractor,
    title: (info.title as string) || "Untitled",
    duration: Number(info.duration) || 0,
    filesize,
    thumbnail: info.thumbnail ?? null,
    uploader: info.uploader ?? info.channel ?? null,
  };
}
