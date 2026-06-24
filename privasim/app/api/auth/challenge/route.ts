import { NextRequest, NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`auth:challenge:${ip}`, RATE_LIMITS.auth);

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

  // Basic address format validation
  if (walletType === "ethereum" && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
  }

  if (walletType === "monero" && walletAddress.length < 95) {
    return NextResponse.json({ error: "Invalid Monero address" }, { status: 400 });
  }

  try {
    const result = await createChallenge(walletAddress);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Challenge creation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
