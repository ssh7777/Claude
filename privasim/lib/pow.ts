// Client-side proof-of-work solver (browser). Fetches a challenge and finds
// a nonce whose SHA-256(salt:nonce) has `difficulty` leading zero bits.
// Runs on the main thread in ~1s; yields periodically so the UI stays smooth.

export interface Challenge {
  salt: string;
  difficulty: number;
  exp: number;
  sig: string;
}

export interface Solution extends Challenge {
  nonce: number;
}

function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) { bits += 8; continue; }
    let x = b, c = 0;
    while ((x & 0x80) === 0) { c++; x <<= 1; }
    return bits + c;
  }
  return bits;
}

export async function solveChallenge(ch: Challenge, timeoutMs = 15000): Promise<Solution> {
  const enc = new TextEncoder();
  const start = Date.now();
  for (let nonce = 0; ; nonce++) {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", enc.encode(`${ch.salt}:${nonce}`))
    );
    if (leadingZeroBits(digest) >= ch.difficulty) {
      return { ...ch, nonce };
    }
    if ((nonce & 0x3ff) === 0 && Date.now() - start > timeoutMs) {
      throw new Error("captcha timeout");
    }
    if ((nonce & 0xfff) === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

export async function getSolvedCaptcha(): Promise<Solution> {
  const res = await fetch("/api/captcha");
  if (!res.ok) throw new Error("Could not load verification challenge");
  const ch = (await res.json()) as Challenge;
  return solveChallenge(ch);
}
