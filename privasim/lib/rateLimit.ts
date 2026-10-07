import { createHmac } from "node:crypto";
import { consumeRateLimit } from "@/lib/db";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Distributed rate limiting backed by PostgreSQL. Identifiers are HMACed before
 * persistence so raw IP addresses / wallet identifiers are not stored in the
 * rate-limit table. Database errors intentionally fail closed at the caller.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(config.windowMs) || config.windowMs < 1 ||
      !Number.isSafeInteger(config.max) || config.max < 1) {
    throw new Error("Invalid rate-limit configuration");
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured to secure rate-limit identifiers");
  }
  const key = createHmac("sha256", secret)
    .update(`rate-limit:${identifier.slice(0, 512)}`)
    .digest("hex");
  return consumeRateLimit(key, config.windowMs, config.max);
}

export const RATE_LIMITS = {
  search: { windowMs: 60_000, max: 30 },
  auth: { windowMs: 60_000, max: 10 },
  orders: { windowMs: 60_000, max: 10 },
  webhook: { windowMs: 60_000, max: 100 },
  global: { windowMs: 60_000, max: 100 },
};
