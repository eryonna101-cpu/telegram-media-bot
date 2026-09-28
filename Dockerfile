# ─────────────────────────────────────────────
# Telegram Media Downloader Bot
# Node.js 24 LTS + grammY + yt-dlp + FFmpeg
# ─────────────────────────────────────────────

# ── Build stage ──
FROM node:24-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Build tools for native modules (better-sqlite3) if no prebuilt binary exists
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --omit=dev --no-audit --no-fund

# ── Runtime stage ──
FROM node:24-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production

# Runtime deps: FFmpeg, Python (for yt-dlp), curl, tini
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        curl \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Install/upgrade yt-dlp via pip (stable channel)
RUN pip3 install --break-system-packages -U "yt-dlp[default]" \
    && yt-dlp --version

WORKDIR /app

# Copy built app + pruned node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Non-root user
RUN groupadd -r bot && useradd -r -g bot -d /app -s /usr/sbin/nologin bot \
    && mkdir -p /tmp/bot /app/data \
    && chown -R bot:bot /app /tmp/bot

USER bot

ENV TEMP_DIR=/tmp/bot \
    DATA_DIR=/app/data

# Simple health: process liveness
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD [ "node", "-e", "process.exit(0)" ]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]