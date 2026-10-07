// Discount codes carry an HMAC-signed payload: LABEL-PERCENT-EXPIRYDAY-SIGNATURE.
// The signature prevents forgery; PostgreSQL state controls activation, revocation,
// and maximum uses. Invoice creation atomically increments the use count with the
// invoice insert, so failed invoice creation does not consume a use.

import { createHmac, timingSafeEqual } from "crypto";

export const MAX_PERCENT = 50;

function couponSecret(): string {
  const value = process.env.COUPON_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("COUPON_SIGNING_SECRET must be at least 32 chars");
  return value;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(`discount:${payload}`).digest("hex").slice(0, 32).toUpperCase();
}

function todayUtcDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function createDiscountCode(label: string, percent: number, validDays: number): string {
  const cleanLabel = label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "PROMO";
  const pct = Math.min(MAX_PERCENT, Math.max(1, Math.round(percent)));
  const expiryDay = todayUtcDay() + Math.min(365, Math.max(1, Math.round(validDays)));
  const payload = `${cleanLabel}-${pct}-${expiryDay}`;
  return `${payload}-${sign(payload, couponSecret())}`;
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

  if (!/^(?:[A-F0-9]{12}|[A-F0-9]{32})$/.test(sig)) {
    return { valid: false, percent: 0, label, reason: "Invalid code" };
  }
  const payload = `${label}-${pct}-${expiryDay}`;
  const keys = sig.length === 32
    ? [process.env.COUPON_SIGNING_SECRET].filter((key): key is string => Boolean(key && key.length >= 32))
    : [process.env.JWT_SECRET].filter((key): key is string => Boolean(key && key.length >= 32));
  const provided = Buffer.from(sig, "hex");
  const validSignature = keys.some((key) => {
    const expected = Buffer.from(sign(payload, key).slice(0, sig.length), "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
  if (!validSignature) {
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

// Full usability check: signature plus PostgreSQL activation, revocation, and
// usage-limit state. Invoice creation rechecks and consumes the use atomically.
export async function checkCouponUsable(code: string): Promise<DiscountCheck> {
  const sig = verifyDiscountCode(code);
  if (!sig.valid) return sig;

  const { getCouponStateRecord } = await import("@/lib/ledger");
  const state = await getCouponStateRecord(code.trim().toUpperCase());
  if (!state) {
    return { valid: false, percent: 0, label: sig.label, reason: "Code is not active" };
  }
  if (state.revoked) {
    return { valid: false, percent: 0, label: sig.label, reason: "Code has been deactivated" };
  }
  if (state.maxUses > 0 && state.uses >= state.maxUses) {
    return { valid: false, percent: 0, label: sig.label, reason: "Code usage limit reached" };
  }
  return sig;
}
