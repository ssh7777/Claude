import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { createDiscountCode, MAX_PERCENT } from "@/lib/discounts";
import { getCouponState, setCouponState, ledgerList, ledgerDelete, ledgerPersistent } from "@/lib/ledger";

// Owner-only coupon management: create (with usage limits), revoke,
// reactivate, and list. Gated by the dedicated ADMIN_API_KEY.

// Create a code
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: string; percent?: number; validDays?: number; maxUses?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label.trim() : "PROMO";
  const percent = Number(body.percent);
  const validDays = Number(body.validDays ?? 30);
  const maxUses = Number(body.maxUses ?? 0);
  if (label.length > 64 || !Number.isInteger(percent) || percent < 1 || percent > MAX_PERCENT) {
    return NextResponse.json({ error: `label must be at most 64 characters and percent must be 1–${MAX_PERCENT}` }, { status: 400 });
  }
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
    return NextResponse.json({ error: "validDays must be an integer from 1 to 365" }, { status: 400 });
  }
  if (!Number.isSafeInteger(maxUses) || maxUses < 0 || maxUses > 1_000_000) {
    return NextResponse.json({ error: "maxUses must be an integer from 0 to 1000000" }, { status: 400 });
  }

  let code: string;
  try {
    code = createDiscountCode(label, percent, validDays);
  } catch {
    return NextResponse.json({ error: "Coupon signing is not configured" }, { status: 503 });
  }
  const persisted = await setCouponState(code, { uses: 0, maxUses, revoked: false });
  if (!persisted) {
    return NextResponse.json({ error: "Coupon state could not be persisted" }, { status: 503 });
  }

  return NextResponse.json({
    code,
    percent,
    validDays,
    maxUses,
    persistent: true,
  }, { headers: { "Cache-Control": "no-store" } });
}

// Revoke or reactivate a code
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string; revoked?: boolean; maxUses?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.code !== "string") {
    return NextResponse.json({ error: "A valid code is required" }, { status: 400 });
  }
  const code = body.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}-\d{1,2}-\d{1,6}-(?:[A-F0-9]{12}|[A-F0-9]{32})$/.test(code)) {
    return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
  }
  if (body.revoked !== undefined && typeof body.revoked !== "boolean") {
    return NextResponse.json({ error: "revoked must be a boolean" }, { status: 400 });
  }
  if (body.maxUses !== undefined && (!Number.isSafeInteger(body.maxUses) || body.maxUses < 0 || body.maxUses > 1_000_000)) {
    return NextResponse.json({ error: "maxUses must be an integer from 0 to 1000000" }, { status: 400 });
  }

  const state = await getCouponState(code);
  const next = {
    ...state,
    revoked: body.revoked ?? state.revoked,
    maxUses: body.maxUses !== undefined ? body.maxUses : state.maxUses,
  };
  const persisted = await setCouponState(code, next);
  if (!persisted) return NextResponse.json({ error: "Coupon state could not be persisted" }, { status: 503 });
  return NextResponse.json({ code, ...next, persistent: true }, { headers: { "Cache-Control": "no-store" } });
}

// Permanently delete a code
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  await ledgerDelete(`cpn_${code.toUpperCase()}`);
  return NextResponse.json({ deleted: code.toUpperCase() });
}

// List all codes with usage
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await ledgerList("cpn_");
  const coupons = Object.entries(items).map(([k, v]) => ({
    code: k.slice(4),
    ...(v as object),
  }));
  return NextResponse.json({ coupons, persistent: ledgerPersistent() }, { headers: { "Cache-Control": "no-store" } });
}
