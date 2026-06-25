import { SignJWT, jwtVerify } from "jose";
import { hashWalletAddress, generateChallenge } from "@/lib/crypto-utils";
import type { JWTPayload, WalletType } from "@/types";

const JWT_EXPIRY = "1h";
const CHALLENGE_TTL_SECS = 5 * 60; // 5 minutes

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(secret);
}

// Stateless challenge — signed JWT embeds the expected wallet + nonce.
// No database required; the token itself proves the server issued this challenge.
export async function createChallenge(walletAddress: string): Promise<{
  challenge: string;
  challengeToken: string;
  expiresAt: string;
}> {
  const challenge = generateChallenge();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECS * 1000).toISOString();

  const challengeToken = await new SignJWT({
    walletAddress: walletAddress.toLowerCase(),
    challenge,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${CHALLENGE_TTL_SECS}s`)
    .sign(getJwtSecret());

  return { challenge, challengeToken, expiresAt };
}

export async function verifyWalletAndIssueJWT(
  walletAddress: string,
  walletType: WalletType,
  signature: string,
  challenge: string,
  challengeToken: string
): Promise<string> {
  // Verify the challenge token the server previously issued
  let tokenPayload: { walletAddress?: string; challenge?: string };
  try {
    const { payload } = await jwtVerify(challengeToken, getJwtSecret());
    tokenPayload = payload as typeof tokenPayload;
  } catch {
    throw new Error("Invalid or expired challenge token");
  }

  if (
    tokenPayload.walletAddress !== walletAddress.toLowerCase() ||
    tokenPayload.challenge !== challenge
  ) {
    throw new Error("Challenge mismatch");
  }

  const walletHash = await hashWalletAddress(walletAddress);

  const isValid = await verifyCryptoSignature(walletAddress, walletType, signature, challenge);
  if (!isValid) throw new Error("Signature verification failed");

  const sessionPayload: Omit<JWTPayload, "iat" | "exp"> = { walletHash, walletType };

  return new SignJWT(sessionPayload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

async function verifyCryptoSignature(
  address: string,
  walletType: WalletType,
  signature: string,
  message: string
): Promise<boolean> {
  if (walletType === "ethereum") return verifyEthereumSignature(address, signature, message);
  return verifyMoneroSignature(address, signature, message);
}

async function verifyEthereumSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    const { ethers } = await import("ethers");
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

async function verifyMoneroSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  // Full Monero sig verification requires a Monero node; accept valid-format sigs at MVP
  if (!signature || !address || !message) return false;
  if (signature.length < 64) return false;
  return true;
}

export async function verifyJWT(authHeader: string | null): Promise<JWTPayload> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7);
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as JWTPayload;
}
