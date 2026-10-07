import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { hashWalletAddress } from "@/lib/crypto-utils";
import { consumeAuthChallenge, registerAuthChallenge } from "@/lib/db";
import type { JWTPayload, WalletType } from "@/types";

const JWT_EXPIRY = "1h";
const CHALLENGE_TTL_SECS = 5 * 60;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(secret);
}

export async function createChallenge(
  walletAddress: string,
  walletType: WalletType
): Promise<{ challenge: string; challengeToken: string; expiresAt: string }> {
  const challenge = `privasim:sign:${randomUUID()}:${Date.now()}`;
  const expires = new Date(Date.now() + CHALLENGE_TTL_SECS * 1000);
  const walletAddressHash = await hashWalletAddress(walletAddress);
  const challengeId = randomUUID();

  const challengeToken = await new SignJWT({
    walletAddress: walletAddress.toLowerCase(),
    walletType,
    challenge,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(challengeId)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getJwtSecret());

  await registerAuthChallenge(challengeId, walletAddressHash, expires);
  return { challenge, challengeToken, expiresAt: expires.toISOString() };
}

export async function verifyWalletAndIssueJWT(
  walletAddress: string,
  walletType: WalletType,
  signature: string,
  challenge: string,
  challengeToken: string
): Promise<string> {
  if (walletType !== "ethereum") {
    throw new Error("Monero wallet sign-in is not supported; payment does not require sign-in");
  }

  let tokenPayload: {
    walletAddress?: string;
    walletType?: string;
    challenge?: string;
    jti?: string;
  };
  try {
    const { payload } = await jwtVerify(challengeToken, getJwtSecret(), {
      algorithms: ["HS256"],
      typ: "JWT",
    });
    tokenPayload = payload as typeof tokenPayload;
  } catch {
    throw new Error("Invalid or expired challenge token");
  }

  if (
    tokenPayload.walletAddress !== walletAddress.toLowerCase() ||
    tokenPayload.walletType !== walletType ||
    tokenPayload.challenge !== challenge ||
    !tokenPayload.jti
  ) {
    throw new Error("Challenge mismatch");
  }

  const isValid = await verifyEthereumSignature(walletAddress, signature, challenge);
  if (!isValid) throw new Error("Wallet signature verification failed");

  const walletHash = await hashWalletAddress(walletAddress);
  const consumed = await consumeAuthChallenge(tokenPayload.jti, walletHash);
  if (!consumed) throw new Error("Challenge already used or expired");

  const sessionPayload: Omit<JWTPayload, "iat" | "exp"> = {
    walletHash,
    walletType,
    authVersion: 2,
  };

  return new SignJWT(sessionPayload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

async function verifyEthereumSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address) || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    return false;
  }
  try {
    const { ethers } = await import("ethers");
    return ethers.verifyMessage(message, signature).toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

export async function verifyJWT(authHeader: string | null): Promise<JWTPayload> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7);
  const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
  if (
    typeof payload.walletHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.walletHash) ||
    (payload.walletType !== "ethereum" && payload.walletType !== "monero") ||
    payload.authVersion !== 2
  ) {
    throw new Error("Invalid session token");
  }
  return payload as unknown as JWTPayload;
}
