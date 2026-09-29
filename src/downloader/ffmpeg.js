import { spawn } from "node:child_process";
import fsp from "node:fs/promises";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

// تشغيل FFmpeg بأمان — بدون shell=True أبدًا، ومعاملات مصفوفة فقط
export function runFfmpeg(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
      finish(reject, new Error("ffmpeg timeout"));
    }, timeoutMs);
    const finish = (fn, arg) => {
      if (!finished) { finished = true; clearTimeout(timer); fn(arg); }
    };
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => finish(reject, e));
    child.on("close", (code) =>
      code === 0
        ? finish(resolve)
        : finish(reject, new Error(stderr.trim().slice(0, 300) || `ffmpeg exited with ${code}`))
    );
  });
}

// دمج Video + Audio بدون إعادة ترميز (سريع)
export async function muxToMp4(videoPath, audioPath, output) {
  await runFfmpeg(["-i", videoPath, "-i", audioPath, "-c", "copy", "-y", output]);
  await fsp.unlink(videoPath).catch(() => {});
  await fsp.unlink(audioPath).catch(() => {});
  return output;
}

// تحويل الحاوية إلى MP4 بدون إعادة ترميز
export async function remuxToMp4(input, output) {
  await runFfmpeg(["-i", input, "-c", "copy", "-movflags", "+faststart", "-y", output]);
  return output;
}

// استخراج الصوت يدويًا (yt-dlp يفعل ذلك افتراضيًا مع -x — هذه للمسارات الخاصة)
export async function extractAudio(input, output) {
  await runFfmpeg(["-i", input, "-vn", "-c:a", "libmp3lame", "-q:a", "0", "-y", output]);
  return output;
}