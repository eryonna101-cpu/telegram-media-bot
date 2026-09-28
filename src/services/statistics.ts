import { usersRepo } from "../database/repositories/users.js";
import { downloadsRepo } from "../database/repositories/downloads.js";
import type { PlatformName } from "../types/index.js";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function isoToday(): string {
  return isoDaysAgo(0);
}

export interface AdminStats {
  users: { total: number; today: number; week: number; month: number; activeWeek: number };
  downloads: {
    total: number;
    successful: number;
    failed: number;
    video: number;
    audio: number;
  };
  platforms: Record<string, number>;
}

export const statisticsService = {
  getAdminStats(): AdminStats {
    const platforms: PlatformName[] = [
      "youtube",
      "tiktok",
      "instagram",
      "facebook",
      "twitter",
      "vimeo",
      "dailymotion",
      "soundcloud",
      "twitch",
    ];
    const platformCounts: Record<string, number> = {};
    for (const p of platforms) platformCounts[p] = downloadsRepo.countByPlatform(p);
    platformCounts.other = downloadsRepo.countByPlatform("other");

    return {
      users: {
        total: usersRepo.countAll(),
        today: usersRepo.countSince(isoToday()),
        week: usersRepo.countSince(isoDaysAgo(7)),
        month: usersRepo.countSince(isoDaysAgo(30)),
        activeWeek: usersRepo.activeSince(isoDaysAgo(7)),
      },
      downloads: {
        total: downloadsRepo.countAll(),
        successful: downloadsRepo.countByStatus("completed"),
        failed: downloadsRepo.countByStatus("failed"),
        video: downloadsRepo.countByMediaType("video"),
        audio: downloadsRepo.countByMediaType("audio"),
      },
      platforms: platformCounts,
    };
  },

  getUserStats(telegramId: number) {
    const u = usersRepo.getByTelegramId(telegramId);
    if (!u) return null;
    return {
      downloads: u.downloads_count,
      successful: u.successful_downloads,
      failed: u.failed_downloads,
      video: u.video_downloads,
      audio: u.audio_downloads,
      joinedAt: u.joined_at,
    };
  },

  growth(days = 14) {
    return usersRepo.growth(days);
  },
};