import { NextRequest, NextResponse } from "next/server";
import { verifyWalletAndIssueJWT } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { WalletType } from "@/types";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`auth:verify:${ip}`, RATE_LIMITS.auth);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: {
    walletAddress?: string;
    walletType?: string;
    signature?: string;
    challenge?: string;
    challengeToken?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, walletType, signature, challenge, challengeToken } = body;
  if (
    typeof walletAddress !== "string" || walletAddress.length > 128 ||
    typeof signature !== "string" || signature.length > 2048 ||
    typeof challenge !== "string" || challenge.length > 512 ||
    typeof challengeToken !== "string" || challengeToken.length > 4096 ||
    !walletAddress || !signature || !challenge || !challengeToken ||
    (walletType !== "ethereum" && walletType !== "monero")
  ) {
    return NextResponse.json({ error: "Invalid wallet verification request" }, { status: 400 });
  }

  try {
    const jwt = await verifyWalletAndIssueJWT(
      walletAddress,
      walletType as WalletType,
      signature,
      challenge,
      challengeToken
    );
    return NextResponse.json({ jwt, expiresIn: 3600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    if (/database|postgres|connection|migrations/i.test(message)) {
      console.error("Wallet verification unavailable:", message);
      return NextResponse.json({ error: "Wallet verification is temporarily unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Wallet verification failed or challenge expired" }, { status: 401 });
  }
}
