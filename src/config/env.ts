import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required"),
  OWNER_ID: z
    .string()
    .min(1, "OWNER_ID is required")
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, "OWNER_ID must be a positive integer"),

  DATABASE_URL: z.string().default(""),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),
  MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().positive().default(2),
  PER_USER_CONCURRENT: z.coerce.number().int().positive().default(1),
  DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),

  USER_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  GLOBAL_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),

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
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const MAX_FILE_SIZE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;

export type Env = typeof env;