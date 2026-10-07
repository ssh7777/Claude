import { NextRequest, NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = await rateLimit(`auth:challenge:${ip}`, RATE_LIMITS.auth);

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

  // Monero signatures are not verified by this service. Never issue a challenge
  // that could be mistaken for a supported authentication method.
  if (walletType === "monero") {
    return NextResponse.json(
      { error: "Monero wallet sign-in is not supported; checkout does not require sign-in." },
      { status: 501 }
    );
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
  }

  try {
    const result = await createChallenge(walletAddress, "ethereum");
    return NextResponse.json(result);
  } catch (err) {
    console.error("Challenge creation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
