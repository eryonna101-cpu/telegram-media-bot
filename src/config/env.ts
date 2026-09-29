import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required").default("6565388032:AAFv0RMibRSDPkDLPGgZ_l6qpILSVaHBpeU"),
  OWNER_ID: z
    .string()
    .default("1883294174")
    .transform((v) => Number(v) || 1883294174),

  DATABASE_URL: z.string().default(""),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),
  MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().positive().default(3),
  PER_USER_CONCURRENT: z.coerce.number().int().positive().default(1),
  DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),

  USER_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  GLOBAL_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(100),

  FORCE_SUBSCRIPTION_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  SUBSCRIPTION_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  YTDLP_UPDATE_CHANNEL: z.enum(["stable", "nightly"]).default("stable"),
  YTDLP_BIN: z.string().default("yt-dlp"),
  FFMPEG_BIN: z.string().default("ffmpeg"),

  TEMP_DIR: z.string().default("/tmp/bot"),
  DATA_DIR: z.string().default("./data"),

  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z.string().default("production"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;

// تصدير المتغيرات المطلوبة مباشرة لتجنب أخطاء الاستيراد
export const MAX_FILE_SIZE_MB = env.MAX_FILE_SIZE_MB;
export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;
