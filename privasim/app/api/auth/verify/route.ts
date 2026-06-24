import { NextRequest, NextResponse } from "next/server";
import { verifyWalletAndIssueJWT } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { WalletType } from "@/types";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`auth:verify:${ip}`, RATE_LIMITS.auth);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { walletAddress?: string; walletType?: string; signature?: string; challenge?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, walletType, signature, challenge } = body;

  if (!walletAddress || !walletType || !signature || !challenge) {
    return NextResponse.json(
      { error: "walletAddress, walletType, signature, and challenge are required" },
      { status: 400 }
    );
  }

  if (!["monero", "ethereum"].includes(walletType)) {
    return NextResponse.json({ error: "Invalid walletType" }, { status: 400 });
  }

  try {
    const jwt = await verifyWalletAndIssueJWT(
      walletAddress,
      walletType as WalletType,
      signature,
      challenge
    );

    return NextResponse.json({ jwt, expiresIn: 3600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
