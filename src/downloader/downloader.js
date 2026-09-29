import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { getPlatform } from "../utils/links.js";
import { remuxToMp4 } from "./ffmpeg.js";

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// تشغيل yt-dlp بأمان — مصفوفة معاملات فقط، بدون shell، مع دعم الإلغاء والمهلة
function runYtDlp(args, { timeoutMs = 0, signal, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let errOut = "";
    let finished = false;

    const finish = (fn, arg) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn(arg);
    };
    const onAbort = () => {
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
      finish(reject, new Error("download aborted"));
    };
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            try { child.kill("SIGKILL"); } catch { /* ignore */ }
            finish(reject, new Error("yt-dlp timeout"));
          }, timeoutMs)
        : null;

    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    child.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      if (onLine) for (const line of s.split(/\r?\n/)) onLine(line);
    });
    child.stderr.on("data", (d) => { errOut += d.toString(); });
    child.on("error", (e) => finish(reject, e));
    child.on("close", (code) => {
      if (code === 0) finish(resolve, out);
      else
        finish(
          reject,
          new Error(
            errOut.trim().split("\n").slice(-3).join(" ").slice(0, 300) ||
              `yt-dlp exited with code ${code}`
          )
        );
    });
  });
}

// فحص الرابط: العنوان، المدة، الصورة المصغرة، الحجم التقريبي
export async function probe(url) {
  const raw = await runYtDlp(
    ["--no-playlist", "--no-warnings", "--dump-single-json", url],
    { timeoutMs: 25000 }
  );
  const data = JSON.parse(raw);
  return {
    title: data.title || null,
    duration: data.duration || null,
    thumbnail: data.thumbnail || null,
    filesize: data.filesize || data.filesize_approx || null,
    width: data.width || null,
    height: data.height || null,
  };
}

// تحميل الوسائط — يرجع { filePath, dir } والمتصل مسؤول عن حذف dir
export async function download(url, { audioOnly = false, signal, onProgress, platform } = {}) {
  const dir = path.join(config.tempDir, randomUUID());
  await fsp.mkdir(dir, { recursive: true });

  const platformOpts = getPlatform(platform)?.ydlOptions ?? [];
  const template = path.join(dir, "media.%(ext)s");

  const args = [
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--restrict-filenames",
    ...platformOpts,
    "--max-filesize",
    String(config.maxFileSize),
    "-o",
    template,
    "--print",
    "after_move:filepath",
  ];
  if (audioOnly) {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    // أفضل فيديو حتى 1080p + أفضل صوت، والدمج إلى MP4 (يستخدم FFmpeg داخليًا)
    args.push("-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4");
  }
  args.push(url);

  const stdout = await runYtDlp(args, {
    signal,
    onLine: (line) => {
      const m = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (m && onProgress) onProgress(Math.min(100, parseFloat(m[1])));
    },
  });

  const filePath = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && fs.existsSync(l))
    .pop();

  if (!filePath) throw new Error("yt-dlp did not produce an output file");

  return { filePath: await postProcess(filePath, audioOnly), dir };
}

// تحويل الحاوية إلى MP4 عند الحاجة (yt-dlp يدمج إلى MP4 عادةً — هذه شبكة أمان)
async function postProcess(filePath, audioOnly) {
  if (audioOnly) return filePath;
  if (path.extname(filePath).toLowerCase() !== ".mp4") {
    const mp4 = filePath.replace(/\.[^.]+$/, "") + ".mp4";
    try {
      await remuxToMp4(filePath, mp4);
      await fsp.unlink(filePath).catch(() => {});
      return mp4;
    } catch {
      return filePath;
    }
  }
  return filePath;
}