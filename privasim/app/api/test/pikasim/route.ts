import { NextRequest, NextResponse } from "next/server";

// Diagnostic endpoint — tests PikaSim API connectivity and env var setup.
// Protected by X-Test-Key header matching PIKASIM_API_KEY so it's not open to the public.

export async function GET(req: NextRequest) {
  const provided = req.headers.get("x-test-key") ?? "";
  const apiKey = process.env.PIKASIM_API_KEY ?? "";

  if (!apiKey || provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized — pass X-Test-Key: <PIKASIM_API_KEY>" }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    env: {
      PIKASIM_API_KEY: apiKey ? `set (${apiKey.slice(0, 8)}...)` : "MISSING",
      PIKASIM_WEBHOOK_SECRET: process.env.PIKASIM_WEBHOOK_SECRET ? "set" : "MISSING — add to Vercel dashboard",
      DB_ENCRYPTION_KEY: process.env.DB_ENCRYPTION_KEY ? "set" : "MISSING",
      JWT_SECRET: process.env.JWT_SECRET ? "set" : "MISSING",
      ETHEREUM_WALLET_ADDRESS: process.env.ETHEREUM_WALLET_ADDRESS ?? "MISSING",
      MONERO_WALLET_PRIMARY: process.env.MONERO_WALLET_PRIMARY ? "set" : "MISSING",
    },
  };

  // Test PikaSim MCP endpoint — check_balance
  const mcpEndpoint = "https://pikasim.com/agentic-esim";
  try {
    const res = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "check_balance", arguments: {} },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }

    results.mcp_check_balance = {
      status: res.status,
      ok: res.ok,
      response: parsed,
    };
  } catch (err) {
    results.mcp_check_balance = { error: String(err) };
  }

  // Test tools/list to discover available tools
  try {
    const res = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }

    results.mcp_tools_list = {
      status: res.status,
      ok: res.ok,
      response: parsed,
    };
  } catch (err) {
    results.mcp_tools_list = { error: String(err) };
  }

  // Test REST package listing
  try {
    const res = await fetch("https://pikasim.com/api/packages/all-countries?country=JP", {
      headers: { Accept: "application/json", "X-API-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      const j = JSON.parse(text);
      parsed = { packages_count: Array.isArray((j as { packages?: unknown[] }).packages) ? (j as { packages: unknown[] }).packages.length : "unknown" };
    } catch { parsed = text.slice(0, 200); }

    results.rest_packages = { status: res.status, ok: res.ok, response: parsed };
  } catch (err) {
    results.rest_packages = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
