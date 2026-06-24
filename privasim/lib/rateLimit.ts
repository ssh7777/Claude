// Simple in-memory rate limiter for edge middleware
// For production, replace with Redis/Upstash for distributed rate limiting

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (existing.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: config.max - existing.count, resetAt: existing.resetAt };
}

// Cleanup old entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetAt) store.delete(key);
    }
  }, 60_000);
}

export const RATE_LIMITS = {
  search: { windowMs: 60_000, max: 30 },
  auth: { windowMs: 60_000, max: 10 },
  orders: { windowMs: 60_000, max: 10 },
  webhook: { windowMs: 60_000, max: 100 },
  global: { windowMs: 60_000, max: 100 },
};
