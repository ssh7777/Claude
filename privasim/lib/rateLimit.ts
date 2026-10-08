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

export interface RateLimitOptions {
  /**
   * Allow the request when the rate-limit store is unreachable.
   *
   * Only safe for read-only, non-monetary endpoints (catalog search, package
   * details). Order creation must stay fail-closed.
   */
  failOpen?: boolean;
}

/**
 * Raised when rate limiting cannot be evaluated. Callers convert this into an
 * actionable response instead of letting it escape as an unhandled 500.
 */
export class RateLimitUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RateLimitUnavailableError";
    this.cause = cause;
  }
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  if (
    !Number.isSafeInteger(config.windowMs) || config.windowMs < 1 ||
    !Number.isSafeInteger(config.max) || config.max < 1
  ) {
    throw new Error("Invalid rate-limit configuration");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const message = "JWT_SECRET is missing or shorter than 32 characters";
    if (options.failOpen) {
      console.error(`[rateLimit] ${message}; allowing request (failOpen)`);
      return { allowed: true, remaining: config.max, resetAt: Date.now() + config.windowMs };
    }
    throw new RateLimitUnavailableError(message);
  }

  const key = createHmac("sha256", secret)
    .update(`rate-limit:${identifier.slice(0, 512)}`)
    .digest("hex");

  try {
    return await consumeRateLimit(key, config.windowMs, config.max);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown database error";
    if (options.failOpen) {
      console.error(`[rateLimit] store unavailable (${message}); allowing request (failOpen)`);
      return { allowed: true, remaining: config.max, resetAt: Date.now() + config.windowMs };
    }
    throw new RateLimitUnavailableError(message, error);
  }
}

export const RATE_LIMITS = {
  search: { windowMs: 60_000, max: 30 },
  auth: { windowMs: 60_000, max: 10 },
  orders: { windowMs: 60_000, max: 10 },
  webhook: { windowMs: 60_000, max: 100 },
  global: { windowMs: 60_000, max: 100 },
};
