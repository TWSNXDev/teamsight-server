import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

// Behind Cloudflare, the client's real IP is reliably given in this header —
// counting X-Forwarded-For hops via `trust proxy` breaks once there's more
// than one proxy in front of us (Cloudflare, then Nginx Proxy Manager).
function clientKey(req: Request) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp) return cfIp;
  return ipKeyGenerator(req.ip ?? "unknown");
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { message: "Too many attempts. Please try again later." },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { message: "AI request limit reached. Please try again later." },
});
