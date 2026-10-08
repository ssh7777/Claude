import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import {
  getWalletSettings,
  setEthereumAddress,
  setMoneroAddress,
  setMarginPercent,
} from "@/lib/settings";

// Owner-only settings. Update receiving crypto addresses AND the retail
// profit margin from the dashboard — validated and persisted to PostgreSQL,
// effective immediately (no redeploy). Gated by ADMIN_API_KEY.

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getWalletSettings(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { monero?: string; ethereum?: string; marginPercent?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.monero !== undefined && typeof body.monero !== "string") {
    return NextResponse.json({ error: "monero must be a string" }, { status: 400 });
  }
  if (body.ethereum !== undefined && typeof body.ethereum !== "string") {
    return NextResponse.json({ error: "ethereum must be a string" }, { status: 400 });
  }

  const results: Record<string, string> = {};
  try {
    if (body.monero) {
      if (!(await setMoneroAddress(body.monero))) throw new Error("Could not persist the Monero address");
      results.monero = "updated";
    }
    if (body.ethereum) {
      if (!(await setEthereumAddress(body.ethereum))) throw new Error("Could not persist the Ethereum address");
      results.ethereum = "updated";
    }
    if (body.marginPercent !== undefined) {
      if (!(await setMarginPercent(Number(body.marginPercent)))) throw new Error("Could not persist the margin");
      results.marginPercent = "updated";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const clientError = /^(Invalid|Margin must)/i.test(message);
    return NextResponse.json(
      { error: clientError ? message : "Settings could not be persisted" },
      { status: clientError ? 400 : 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json({ ...results, settings: await getWalletSettings() }, { headers: { "Cache-Control": "no-store" } });
}
