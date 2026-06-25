import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    await verifyJWT(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: `Order ${params.orderId} not found` },
    { status: 404 }
  );
}
