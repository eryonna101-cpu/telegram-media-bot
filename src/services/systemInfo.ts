import { getYtdlpVersion, checkYtdlpUpdate } from "../downloader/ytdlp.js";
import { getFfmpegVersion } from "../downloader/ffmpeg.js";
import { logger } from "../utils/logger.js";

export const systemInfoService = {
  async versions(): Promise<{ ytdlp: string; ffmpeg: string; node: string }> {
    let ytdlp = "unknown";
    let ffmpeg = "unknown";
    try {
      ytdlp = await getYtdlpVersion();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "yt-dlp version failed");
    }
    try {
      ffmpeg = await getFfmpegVersion();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "ffmpeg version failed");
    }
    return { ytdlp, ffmpeg, node: process.versions.node };
  },

  async updateStatus(): Promise<{ current: string; latest: string; updateAvailable: boolean }> {
    try {
      return await checkYtdlpUpdate();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "yt-dlp update check failed");
      const current = await getYtdlpVersion().catch(() => "unknown");
      return { current, latest: current, updateAvailable: false };
    }
  },
};