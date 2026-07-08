import { NextRequest, NextResponse } from "next/server";
import {
  getWalletSettings,
  setMoneroAddress,
  setEthereumAddress,
} from "@/lib/settings";

// Owner-only wallet management. Update the receiving crypto addresses from
// the dashboard — validated, persisted to the ledger, effective immediately
// (no redeploy). Gated by the reseller API key.

function authorized(req: NextRequest): boolean {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  return !!apiKey && req.headers.get("x-admin-key") === apiKey;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getWalletSettings());
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { monero?: string; ethereum?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: Record<string, string> = {};
  try {
    if (body.monero) {
      await setMoneroAddress(body.monero);
      results.monero = "updated";
    }
    if (body.ethereum) {
      await setEthereumAddress(body.ethereum);
      results.ethereum = "updated";
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ...results, settings: await getWalletSettings() });
}
