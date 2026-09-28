# Telegram Media Downloader Bot

بوت تحميل وسائط احترافي (Production-Ready) يعمل بالكامل داخل Telegram باستخدام **Inline Keyboard** — بدون أي واجهة ويب أو Dashboard خارجي.

## الميزات

- 🎬 تحميل فيديو / 🎵 استخراج MP3 عبر **yt-dlp + FFmpeg**
- 📱 اكتشاف المنصة تلقائيًا (YouTube, TikTok, Instagram, Facebook, Twitter/X, Vimeo, Dailymotion, SoundCloud, Twitch...)
- 🔒 نظام اشتراك إجباري في القنوات (Force Subscription) مع Cache + TTL
- ⚡ طابور تحميل حقيقي (Concurrency limit, per-user rate limit, global rate limit, timeout, cancel حقيقي للعملية)
- 🗑 إدارة ملفات مؤقتة + Cleanup Worker دوري
- 📊 إحصائيات حقيقية من قاعدة البيانات (مستخدمون، تحميلات، منصات)
- ⚙️ لوحة أدمن كاملة داخل Telegram (إحصائيات، مستخدمون، بحث، حظر، broadcast، إدارة قنوات، نظام، logs)
- 🛡️ حماية SSRF، تحقق الروابط، بدون shell=true، بدون تمرير مدخلات المستخدم لـ yt-dlp كـ arguments
- 📦 قابل للنشر على Railway / VPS عبر Docker

## Tech Stack

- Node.js 24 LTS + TypeScript (ESM)
- grammY (إطار بوت Telegram)
- yt-dlp + FFmpeg (محرّك التحميل)
- SQLite (better-sqlite3) مع طبقة Repository قابلة للانتقال إلى PostgreSQL
- Zod (تحقق متغيرات البيئة) + pino (Logging)
- Docker + Docker Compose

## المتطلبات (Environment Variables)

انسخ `.env.example` إلى `.env` واملأ القيم:

| Variable | الوصف | افتراضي |
|---|---|---|
| `BOT_TOKEN` | توكن البوت من BotFather | — |
| `OWNER_ID` | Telegram ID الخاص بك (أدمن) | — |
| `DATABASE_URL` | مسار ملف SQLite (اختياري) | `./data/bot.db` |
| `MAX_FILE_SIZE_MB` | أقصى حجم ملف للإرسال | `50` |
| `MAX_CONCURRENT_DOWNLOADS` | أقصى تحميلات متزامنة | `2` |
| `PER_USER_CONCURRENT` | أقصى تحميل متزامن للمستخدم | `1` |
| `DOWNLOAD_TIMEOUT_SECONDS` | مهلة التحميل | `300` |
| `USER_RATE_LIMIT_PER_MIN` | حد طلبات/دقيقة للمستخدم | `10` |
| `GLOBAL_RATE_LIMIT_PER_MIN` | حد طلبات/دقيقة عام | `60` |
| `FORCE_SUBSCRIPTION_ENABLED` | تفعيل الاشتراك الإجباري | `false` |
| `SUBSCRIPTION_CACHE_TTL_SECONDS` | TTL لـcache الاشتراك | `300` |
| `YTDLP_UPDATE_CHANNEL` | قناة تحديث yt-dlp (`stable`/`nightly`) | `stable` |
| `TEMP_DIR` | مجلد الملفات المؤقتة | `/tmp/bot` |
| `DATA_DIR` | مجلد البيانات | `./data` |
| `LOG_LEVEL` | مستوى اللوغ | `info` |
| `NODE_ENV` | البيئة | `production` |

## التشغيل المحلي

```bash
cp .env.example .env
# عدّل BOT_TOKEN و OWNER_ID
npm install
npm run build
npm start
# أو للتطوير:
npm run dev
```

> يتطلب وجود `yt-dlp` و `ffmpeg` في الـPATH.

## التشغيل عبر Docker

```bash
cp .env.example .env
docker compose up -d --build
```

الـDockerfile يثبّت FFmpeg + Python + yt-dlp تلقائيًا.

## النشر على Railway

1. ارفع المشروع إلى GitHub.
2. في Railway: **New Project → Deploy from GitHub repo**.
3. أضف متغيرات البيئة من `.env`.
4. Railway سيكتشف الـDockerfile ويبني الصورة تلقائيًا.
5. لا حاجة لـPORT — البوت يعمل بـlong polling.

## أوامر الأدمن (داخل Telegram)

- `/start` — الترحيب
- `/block <telegram_id>` — حظر مستخدم
- `/unblock <telegram_id>` — فك الحظر
- اضغط زر الأدمن (يظهر تلقائيًا للـOWNER_ID) → لوحة كاملة.

## الأمان

- لا يُستخدم `shell: true` مع مدخلات المستخدم.
- الروابط تُمرّر كـarguments آمنة إلى `execFile/spawn` (ليست shell).
- تحقق البروتوكولات (http/https فقط) + حظر العناوين الخاصة (SSRF).
- لا يُسمح للمستخدم بتمرير arguments إلى yt-dlp.
- لا يتم تجاوز الحسابات الخاصة / DRM / المحتوى المحمي.

## الهيكل

```
bot/
├── src/
│   ├── index.ts
│   ├── config/env.ts
│   ├── bot/
│   │   ├── bot.ts
│   │   ├── middleware/ (auth, subscription, rateLimit, errors)
│   │   ├── handlers/ (start, links, downloads, stats, admin)
│   │   ├── keyboards/ (user, download, admin, subscription)
│   │   └── states/adminStates.ts
│   ├── downloader/ (engine, ytdlp, ffmpeg, detector, queue)
│   ├── database/ (database, repositories, migrations)
│   ├── services/ (subscription, statistics, broadcast, cleanup, systemInfo)
│   ├── utils/ (logger, urls, files, errors)
│   └── types/index.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## ملاحظات

- قاعدة البيانات SQLite مع طبقة Repository تسمح بالانتقال إلى PostgreSQL بتغيير طبقة `database/` فقط.
- تحديث yt-dlp: افحص من لوحة الأدمن (🧰 النظام → Check Updates). التحديث الفعلي يُطبّق عند إعادة البناء/النشر لضمان استقرار الإنتاج.
- لا تُخزّن أسرار في الكود — كلها في `.env`.