// Encryption and pseudonymous identifiers for sensitive persisted fields.

import { createHmac, randomBytes, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

const ALGORITHM = "AES-GCM";

function getEncryptionKey(): Uint8Array {
  const configured = process.env.DB_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("DB_ENCRYPTION_KEY is not configured");

  let key: Buffer;
  if (/^[a-fA-F0-9]{64}$/.test(configured)) {
    key = Buffer.from(configured, "hex");
  } else if (configured.startsWith("base64:")) {
    key = Buffer.from(configured.slice("base64:".length), "base64");
  } else {
    key = Buffer.from(configured, "utf8");
  }

  if (key.length !== 32) {
    throw new Error("DB_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex chars or base64:<32-byte-key>)");
  }
  return new Uint8Array(key);
}

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(rawKey);
  return crypto.subtle.importKey("raw", keyBytes as unknown as BufferSource, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptField(plaintext: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decryptField(encrypted: string): Promise<string> {
  const key = await importKey(getEncryptionKey());
  const combined = Buffer.from(encrypted, "base64");
  if (combined.length < 29) throw new Error("Invalid encrypted field");
  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export async function hashWalletAddress(address: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return createHmac("sha256", secret)
    .update(`wallet:${address.toLowerCase().trim()}`)
    .digest("hex");
}

export function generateSecureId(bytes = 16): string {
  if (!Number.isSafeInteger(bytes) || bytes < 16 || bytes > 64) {
    throw new Error("Secure IDs must use between 16 and 64 random bytes");
  }
  return randomBytes(bytes).toString("hex");
}

export function generateChallenge(): string {
  return `privasim:sign:${randomBytes(32).toString("hex")}:${Date.now()}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  if (aBytes.length !== bBytes.length) return false;
  return nodeTimingSafeEqual(aBytes, bBytes);
}
