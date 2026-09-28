import { spawn } from "node:child_process";
import { env } from "../config/env.js";

export function getFfmpegVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.FFMPEG_BIN, ["-version"], { windowsHide: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffmpeg version failed"));
      resolve(out.split("\n")[0].replace("ffmpeg version", "").trim().split(" ")[0]);
    });
  });
}