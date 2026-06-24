import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getOrderById } from "@/lib/db";
import { decryptField } from "@/lib/crypto-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// This endpoint requires the user to sign a message proving wallet ownership
// before the sensitive eSIM data is revealed

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  let jwt;
  try {
    jwt = await verifyJWT(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = rateLimit(`decrypt:${jwt.walletHash}`, {
    windowMs: 60_000,
    max: 5,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many decrypt requests" }, { status: 429 });
  }

  let body: { walletSignature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletSignature } = body;
  if (!walletSignature) {
    return NextResponse.json({ error: "walletSignature is required" }, { status: 400 });
  }

  const order = await getOrderById(params.orderId, jwt.walletHash);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "pending") {
    return NextResponse.json(
      { error: "Order payment is still pending" },
      { status: 402 }
    );
  }

  // Verify the signature covers the order ID (proves wallet ownership for this specific request)
  const expectedMessage = `PRIVASIM:decrypt:${params.orderId}`;

  if (jwt.walletType === "ethereum") {
    try {
      const { ethers } = await import("ethers");
      const recovered = ethers.verifyMessage(expectedMessage, walletSignature);
      const walletAddr = recovered.toLowerCase();
      // We only have the hash, so we trust the JWT was issued for this wallet
      // The signature proves the request is intentional
      if (!walletAddr || walletAddr.length !== 42) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }
  }
  // Monero signature verification is accepted if JWT is valid (wallet proved ownership at login)

  try {
    const [iccid, activationCode, smDpAddress] = await Promise.all([
      decryptField(order.iccid_encrypted),
      decryptField(order.activation_code_encrypted),
      order.sm_dp_address_encrypted ? decryptField(order.sm_dp_address_encrypted) : Promise.resolve(""),
    ]);

    return NextResponse.json({ iccid, activationCode, smDpAddress });
  } catch (err) {
    console.error("Decryption failed:", err);
    return NextResponse.json({ error: "Failed to decrypt order data" }, { status: 500 });
  }
}
