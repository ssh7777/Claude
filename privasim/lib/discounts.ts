// Discount codes — stateless and forge-proof.
//
// A code carries its own signed payload: LABEL-PERCENT-EXPIRYDAY-SIGNATURE
// (e.g. LAUNCH-20-20643-a1b2c3d4e5f6). The signature is an HMAC-SHA256 over
// the payload using JWT_SECRET, so codes cannot be created or altered
// without the server secret. No database needed.
//
// Security properties:
// - Forgery impossible without JWT_SECRET (HMAC, timing-safe compare)
// - Percent hard-capped at MAX_PERCENT server-side
// - Expiry enforced (day granularity, UTC)
// - Validation endpoint is rate-limited; creation is admin-key-gated
// Limitation (stateless by design): codes are not single-use — treat them
// as marketing campaign codes with expiry dates, not one-off vouchers.

import { createHmac, timingSafeEqual } from "crypto";

export const MAX_PERCENT = 50;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`discount:${payload}`).digest("hex").slice(0, 12);
}

function todayUtcDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function createDiscountCode(label: string, percent: number, validDays: number): string {
  const cleanLabel = label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "PROMO";
  const pct = Math.min(MAX_PERCENT, Math.max(1, Math.round(percent)));
  const expiryDay = todayUtcDay() + Math.min(365, Math.max(1, Math.round(validDays)));
  const payload = `${cleanLabel}-${pct}-${expiryDay}`;
  return `${payload}-${sign(payload)}`.toUpperCase();
}

export interface DiscountCheck {
  valid: boolean;
  percent: number;
  label: string;
  reason?: string;
}

export function verifyDiscountCode(code: string): DiscountCheck {
  const parts = (code ?? "").trim().toUpperCase().split("-");
  if (parts.length !== 4) return { valid: false, percent: 0, label: "", reason: "Invalid code format" };

  const [label, pctStr, expStr, sig] = parts;
  const pct = parseInt(pctStr, 10);
  const expiryDay = parseInt(expStr, 10);

  if (!Number.isFinite(pct) || pct < 1 || pct > MAX_PERCENT) {
    return { valid: false, percent: 0, label, reason: "Invalid discount amount" };
  }
  if (!Number.isFinite(expiryDay)) {
    return { valid: false, percent: 0, label, reason: "Invalid code" };
  }

  const expected = sign(`${label}-${pct}-${expiryDay}`).toUpperCase();
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, percent: 0, label, reason: "Invalid code" };
  }

  if (todayUtcDay() > expiryDay) {
    return { valid: false, percent: 0, label, reason: "Code expired" };
  }

  return { valid: true, percent: pct, label };
}

// Apply a verified discount to a retail price. Floor keeps orders payable.
export function applyDiscount(retailUsd: number, percent: number): number {
  const discounted = retailUsd * (1 - percent / 100);
  return Math.max(0.5, Math.ceil(discounted * 100) / 100);
}
