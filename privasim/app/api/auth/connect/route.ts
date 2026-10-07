import { NextResponse } from "next/server";

// Legacy insecure address-only login endpoint. Wallets must sign a one-time
// challenge through /api/auth/challenge and /api/auth/verify.
export async function POST() {
  return NextResponse.json(
    { error: "Address-only sign-in has been removed. Sign a one-time wallet challenge instead." },
    { status: 410 }
  );
}
