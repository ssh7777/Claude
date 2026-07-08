// Proof-of-work CAPTCHA — self-hosted, no external service, no tracking.
//
// The server hands out a signed challenge (salt + difficulty). The browser
// must find a nonce whose SHA-256(salt+nonce) has `difficulty` leading zero
// bits — ~1 second of work, invisible to a human, but costly to a bot doing
// it thousands of times. The solution is verified server-side before an
// order is created. The challenge is HMAC-signed and time-boxed, so it can't
// be forged or reused after expiry.

import { createHmac, timingSafeEqual, createHash } from "crypto";

const DIFFICULTY = 18; // leading zero BITS (~1s on a normal phone)
const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not configured");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(`captcha:${data}`).digest("base64url");
}

export function createChallenge(): { salt: string; difficulty: number; exp: number; sig: string } {
  const salt = createHash("sha256").update(`${Date.now()}:${Math.random()}`).digest("hex").slice(0, 24);
  const exp = Date.now() + TTL_MS;
  const difficulty = DIFFICULTY;
  const sig = sign(`${salt}.${difficulty}.${exp}`);
  return { salt, difficulty, exp, sig };
}

function leadingZeroBits(hexHash: string): number {
  let bits = 0;
  for (const ch of hexHash) {
    const nibble = parseInt(ch, 16);
    if (nibble === 0) { bits += 4; continue; }
    if (nibble < 2) return bits + 3;
    if (nibble < 4) return bits + 2;
    if (nibble < 8) return bits + 1;
    return bits;
  }
  return bits;
}

export function verifySolution(sol: {
  salt?: string;
  difficulty?: number;
  exp?: number;
  sig?: string;
  nonce?: string | number;
}): boolean {
  const { salt, difficulty, exp, sig, nonce } = sol ?? {};
  if (!salt || !difficulty || !exp || !sig || nonce === undefined) return false;
  if (Date.now() > exp) return false;

  // Verify the challenge was issued by us and not tampered with
  const expected = sign(`${salt}.${difficulty}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // Verify the proof of work
  const hash = createHash("sha256").update(`${salt}:${nonce}`).digest("hex");
  return leadingZeroBits(hash) >= difficulty;
}
