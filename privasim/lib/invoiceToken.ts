// Signed invoice tokens — the tamper-proof source of truth for an order.
//
// The in-memory invoice store does not survive across serverless instances,
// so verify-payment used to fall back to CLIENT-SUPPLIED package/amount data
// after a cold start. That allowed paying for a cheap package and claiming an
// expensive one. Now orders/create issues an HMAC-signed token embedding the
// real order parameters; the client stores and returns it, but cannot alter
// it. verify-payment only acts on server-memory invoices or valid tokens.

import { createHmac, timingSafeEqual } from "crypto";

export interface InvoicePayload {
  invoiceId: string;
  packageCode: string;
  cryptoType: string;
  amountCrypto: number;
  amountUsd: number;
  topupIccid?: string;
  discountCode?: string;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not configured");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(`invoice:${data}`).digest("base64url");
}

export function createInvoiceToken(payload: Omit<InvoicePayload, "exp">): string {
  const full: InvoicePayload = { ...payload, exp: Math.floor(Date.now() / 1000) + 24 * 3600 };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyInvoiceToken(token: string): InvoicePayload | null {
  const dot = (token ?? "").lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as InvoicePayload;
    if (!payload.invoiceId || !payload.packageCode) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
