import { NextRequest, NextResponse } from "next/server";
import { createDiscountCode, MAX_PERCENT } from "@/lib/discounts";
import { getCouponState, setCouponState, ledgerList, ledgerPersistent } from "@/lib/ledger";

// Owner-only coupon management: create (with usage limits), revoke,
// reactivate, and list. Gated by the reseller API key.

function authorized(req: NextRequest): boolean {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  const provided = req.headers.get("x-admin-key") ?? "";
  return !!apiKey && provided === apiKey;
}

// Create a code
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: string; percent?: number; validDays?: number; maxUses?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const percent = Number(body.percent);
  const validDays = Number(body.validDays ?? 30);
  const maxUses = Math.max(0, Math.round(Number(body.maxUses ?? 0))); // 0 = unlimited
  if (!Number.isFinite(percent) || percent < 1 || percent > MAX_PERCENT) {
    return NextResponse.json({ error: `percent must be 1–${MAX_PERCENT}` }, { status: 400 });
  }

  const code = createDiscountCode(body.label ?? "PROMO", percent, validDays);
  await setCouponState(code, { uses: 0, maxUses, revoked: false });

  return NextResponse.json({
    code,
    percent: Math.round(percent),
    validDays: Math.round(validDays),
    maxUses,
    persistent: ledgerPersistent(),
  });
}

// Revoke or reactivate a code
export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string; revoked?: boolean; maxUses?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const state = await getCouponState(body.code);
  const next = {
    ...state,
    revoked: body.revoked ?? state.revoked,
    maxUses: body.maxUses !== undefined ? Math.max(0, Math.round(body.maxUses)) : state.maxUses,
  };
  const persisted = await setCouponState(body.code, next);
  return NextResponse.json({ code: body.code.toUpperCase(), ...next, persistent: persisted });
}

// List all codes with usage
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await ledgerList("cpn_");
  const coupons = Object.entries(items).map(([k, v]) => ({
    code: k.slice(4),
    ...(v as object),
  }));
  return NextResponse.json({ coupons, persistent: ledgerPersistent() });
}
