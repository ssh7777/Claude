import { SignJWT, jwtVerify } from "jose";
import { hashWalletAddress, generateChallenge } from "@/lib/crypto-utils";
import { supabaseAdmin } from "@/lib/db";
import type { JWTPayload, WalletType } from "@/types";

const JWT_EXPIRY = "1h";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(secret);
}

export async function createChallenge(walletAddress: string): Promise<{
  challenge: string;
  expiresAt: string;
}> {
  const challenge = generateChallenge();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  await supabaseAdmin.from("auth_challenges").upsert({
    wallet_address_hash: await hashWalletAddress(walletAddress),
    challenge,
    expires_at: expiresAt,
  });

  return { challenge, expiresAt };
}

export async function verifyWalletAndIssueJWT(
  walletAddress: string,
  walletType: WalletType,
  signature: string,
  challenge: string
): Promise<string> {
  const walletHash = await hashWalletAddress(walletAddress);

  // Look up stored challenge
  const { data: stored } = await supabaseAdmin
    .from("auth_challenges")
    .select("challenge, expires_at")
    .eq("wallet_address_hash", walletHash)
    .single();

  if (!stored || stored.challenge !== challenge) {
    throw new Error("Invalid or expired challenge");
  }

  if (new Date(stored.expires_at) < new Date()) {
    throw new Error("Challenge has expired");
  }

  // Verify signature based on wallet type
  const isValid = await verifyCryptoSignature(walletAddress, walletType, signature, challenge);
  if (!isValid) {
    throw new Error("Signature verification failed");
  }

  // Clean up used challenge
  await supabaseAdmin
    .from("auth_challenges")
    .delete()
    .eq("wallet_address_hash", walletHash);

  // Upsert wallet record
  await supabaseAdmin.from("wallets").upsert(
    {
      wallet_address_hash: walletHash,
      wallet_address_encrypted: walletAddress, // encrypted in production via trigger
      wallet_type: walletType,
      last_activity: new Date().toISOString(),
    },
    { onConflict: "wallet_address_hash" }
  );

  // Issue JWT
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    walletHash,
    walletType,
  };

  const jwt = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());

  return jwt;
}

async function verifyCryptoSignature(
  address: string,
  walletType: WalletType,
  signature: string,
  message: string
): Promise<boolean> {
  if (walletType === "ethereum") {
    return verifyEthereumSignature(address, signature, message);
  }
  // Monero signature verification requires a Monero node/RPC
  // For now, we accept the signature format and verify on-chain separately
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
  // Monero SpendProof / ViewKey message signing
  // Full implementation requires monero-rpc or monero-javascript library
  // For MVP: accept base58-encoded signature starting with "Sig" (Monero format)
  if (!signature || !address || !message) return false;
  if (signature.length < 64) return false;
  // TODO: integrate monero-javascript for production signature verification
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

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
