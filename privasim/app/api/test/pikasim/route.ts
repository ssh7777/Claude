import { NextRequest, NextResponse } from "next/server";
import { parseMcpBody } from "@/lib/pikasim";

// Diagnostic endpoint — tests PikaSim API connectivity and env var setup.
// Protected by X-Test-Key header matching PIKASIM_API_KEY so it's not open to the public.

export async function GET(req: NextRequest) {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  // Accept key via header OR query param so this can be opened directly in a browser
  const provided =
    req.headers.get("x-test-key") ??
    new URL(req.url).searchParams.get("key") ??
    "";

  if (!apiKey) {
    return new Response(
      `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#f90">
        <h2 style="color:#f44">⚠ PIKASIM_API_KEY Not Configured</h2>
        <p style="color:#fff"><strong>The PIKASIM_API_KEY environment variable is not set on this server.</strong></p>
        <p>Go to: <strong>Vercel Dashboard → Your Project → Settings → Environment Variables</strong></p>
        <p>Add: <code style="color:#0f0">PIKASIM_API_KEY</code> = your PikaSim reseller key (starts with <code style="color:#0f0">pk_live_</code>)</p>
        <p>Also add: <code style="color:#0f0">PIKASIM_WEBHOOK_SECRET</code> = the webhook secret from PikaSim dashboard</p>
        <p style="color:#aaa">After adding, click <strong>Redeploy</strong> in the Vercel dashboard.</p>
      </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html" } }
    );
  }

  if (provided !== apiKey) {
    return new Response(
      `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#f90">
        <h2>PikaSim Diagnostic</h2>
        <p>Open this URL in your browser:</p>
        <code style="color:#fff">https://claude-pqapgzaz5-guardpass.vercel.app/api/test/pikasim?key=YOUR_PIKASIM_API_KEY</code>
        <p style="color:#f44">Wrong key. Pass ?key=&lt;PIKASIM_API_KEY&gt; in the URL (same value as the one set in Vercel).</p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
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
  const mcpEndpoint = "https://pikasim.com/mcp";
  try {
    const res = await fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
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
    try { parsed = Object.keys(parseMcpBody(text)).length ? parseMcpBody(text) : text.slice(0, 500); }
    catch { parsed = text.slice(0, 500); }

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
        "Accept": "application/json, text/event-stream",
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
    try { parsed = Object.keys(parseMcpBody(text)).length ? parseMcpBody(text) : text.slice(0, 500); }
    catch { parsed = text.slice(0, 500); }

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

  // Test purchase_esim with an invalid package code — should get "not found" error, no charge
  // This proves the auth + tool call chain works end-to-end without spending money.
  try {
    const res = await fetch("https://pikasim.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "purchase_esim", arguments: { packageCode: "TEST_INVALID_PROBE" } },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = Object.keys(parseMcpBody(text)).length ? parseMcpBody(text) : text.slice(0, 500); }
    catch { parsed = text.slice(0, 500); }

    // Expected: HTTP 200 with JSON-RPC error body (package not found) — that's a success for us.
    // If we get HTTP 401/403 → API key wrong or not set.
    // If we get HTTP 404 → wrong endpoint URL.
    // If we get HTTP 200 with iccid → it actually purchased (unlikely with invalid code).
    results.mcp_purchase_probe = {
      status: res.status,
      ok: res.ok,
      note: res.status === 401 || res.status === 403
        ? "AUTH FAILED — check PIKASIM_API_KEY"
        : res.status === 404
        ? "WRONG ENDPOINT — /mcp not found"
        : res.status === 406
        ? "ACCEPT HEADER REJECTED — must send application/json + text/event-stream"
        : "Endpoint reachable — see response for tool result",
      response: parsed,
    };
  } catch (err) {
    results.mcp_purchase_probe = { error: String(err) };
  }

  const pretty = JSON.stringify(results, null, 2);
  return new Response(
    `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#0f0">
      <h2 style="color:#ff6600">PikaSim Diagnostic Results</h2>
      <pre style="white-space:pre-wrap;color:#ccc">${pretty}</pre>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
