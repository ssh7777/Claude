// Short-lived bearer proof for a customer's invoice. Payment terms and package
// data are loaded only from PostgreSQL and are never trusted from the browser.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface InvoicePayload {
  invoiceId: string;
  purpose: "invoice";
  version: 2;
  exp: number;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(`invoice:v2:${data}`).digest("base64url");
}

export function createInvoiceToken(invoiceId: string): string {
  const payload: InvoicePayload = {
    invoiceId,
    purpose: "invoice",
    version: 2,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyInvoiceToken(token: string): InvoicePayload | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const data = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  let expected: Buffer;
  try {
    expected = Buffer.from(sign(data));
  } catch {
    return null;
  }
  const provided = Buffer.from(signature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as InvoicePayload;
    if (
      typeof payload.invoiceId !== "string" ||
      !/^[a-f0-9]{32}$/.test(payload.invoiceId) ||
      payload.purpose !== "invoice" ||
      payload.version !== 2 ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
