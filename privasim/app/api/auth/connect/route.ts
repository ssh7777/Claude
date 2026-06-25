import { NextRequest, NextResponse } from "next/server";
import { issueJWT } from "@/lib/auth";
import { hashWalletAddress } from "@/lib/crypto-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { WalletType } from "@/types";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`auth:connect:${ip}`, RATE_LIMITS.auth);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { walletAddress?: string; walletType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, walletType } = body;

  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  if (!walletType || !["monero", "ethereum"].includes(walletType)) {
    return NextResponse.json({ error: "walletType must be 'monero' or 'ethereum'" }, { status: 400 });
  }
  if (walletType === "ethereum" && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
  }
  if (walletType === "monero" && walletAddress.length < 95) {
    return NextResponse.json({ error: "Invalid Monero address (must be 95+ chars)" }, { status: 400 });
  }

  try {
    const walletHash = await hashWalletAddress(walletAddress);
    const jwt = await issueJWT(walletHash, walletType as WalletType);
    return NextResponse.json({ jwt, expiresIn: 3600 });
  } catch (err) {
    console.error("Connect failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
