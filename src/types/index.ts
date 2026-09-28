export type MediaType = "video" | "audio";

export type DownloadStatus =
  | "queued"
  | "processing"
  | "downloading"
  | "converting"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export type PlatformName =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "twitter"
  | "vimeo"
  | "dailymotion"
  | "soundcloud"
  | "twitch"
  | "other";

export interface MediaInfo {
  title: string;
  duration: number; // seconds
  filesize: number | null; // bytes (may be null)
  platform: PlatformName;
  extractor: string;
  thumbnail: string | null;
  uploader: string | null;
}

export interface DownloadResult {
  filePath: string;
  title: string;
  platform: PlatformName;
  duration: number;
  fileSize: number;
  mediaType: MediaType;
}

export interface DownloadJob {
  id: string;
  userId: number;
  url: string;
  mediaType: MediaType;
  status: DownloadStatus;
  position: number;
  createdAt: number;
  abort: AbortController;
}

export type ProgressStage =
  | "queued"
  | "detecting"
  | "downloading"
  | "converting"
  | "sending";

export interface ProgressUpdate {
  stage: ProgressStage;
  percent: number; // 0..100
  message: string;
}

export interface UserRow {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_bot: number;
  is_blocked: number;
  joined_at: string;
  last_seen_at: string;
  downloads_count: number;
  successful_downloads: number;
  failed_downloads: number;
  audio_downloads: number;
  video_downloads: number;
}

export interface DownloadRow {
  id: number;
  user_id: number;
  url: string;
  platform: string;
  media_type: MediaType;
  status: DownloadStatus;
  file_size: number | null;
  duration: number | null;
  title: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface ChannelRow {
  id: number;
  chat_id: string;
  username: string | null;
  invite_url: string;
  title: string;
  enabled: number;
}

export interface AdminState {
  state: string;
  data: Record<string, unknown>;
}