// Symmetric encryption for sensitive DB fields
// Uses AES-256-GCM via Web Crypto API (Node.js built-in)

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

function getEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error("DB_ENCRYPTION_KEY must be at least 32 chars");
  return key;
}

async function importKey(rawKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(rawKey.slice(0, 32));
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, [
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
  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);

  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export async function hashWalletAddress(address: string): Promise<string> {
  const data = new TextEncoder().encode(address.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

export function generateSecureId(bytes = 16): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("hex");
}

export function generateChallenge(): string {
  const random = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  return `privasim:sign:${random}:${Date.now()}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}
