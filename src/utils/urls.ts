import { URL } from "node:url";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Private / loopback / link-local IP ranges — SSRF protection
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;

  // IPv4
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reserved
  }

  // IPv6 loopback / link-local
  if (host === "::1" || host === "::" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  return false;
}

export interface ValidationResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

export function validateMediaUrl(input: string): ValidationResult {
  if (!input || typeof input !== "string") {
    return { ok: false, reason: "empty" };
  }

  const trimmed = input.trim();
  if (trimmed.length > 2048) {
    return { ok: false, reason: "too_long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: "protocol_not_allowed" };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: "no_hostname" };
  }

  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, reason: "private_host" };
  }

  // Strip hash, normalize
  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}

export function isLikelyUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}