import { NextRequest, NextResponse } from "next/server";

// Test endpoint: calls PikaSim purchase_esim directly, bypassing crypto payment.
// Use this to verify the PikaSim API key and purchase flow work before going live.
// Protected by ?key=<PIKASIM_API_KEY> in the URL.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  const provided = url.searchParams.get("key") ?? req.headers.get("x-test-key") ?? "";
  const packageCode = url.searchParams.get("package") ?? "";

  if (!apiKey || provided !== apiKey) {
    return new Response(
      `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ff6600">
        <h2>PikaSim Buy Test</h2>
        <p>Usage: <code style="color:#fff">?key=YOUR_PIKASIM_API_KEY&amp;package=PACKAGE_CODE</code></p>
        <p>Wrong or missing API key.</p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!packageCode) {
    // Step 1: list available packages so user can pick one
    try {
      const res = await fetch("https://pikasim.com/api/packages/all-countries?country=JP", {
        headers: { Accept: "application/json", "X-API-Key": apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let packages: { packageCode: string; name?: string; packageName?: string; priceUSD?: number; price?: number }[] = [];
      try {
        const j = JSON.parse(text);
        packages = (j.packages ?? []).slice(0, 10);
      } catch { /* ignore */ }

      const rows = packages.map(p =>
        `<tr>
          <td style="padding:4px 12px">${p.packageCode}</td>
          <td style="padding:4px 12px">${p.name ?? p.packageName ?? "-"}</td>
          <td style="padding:4px 12px">$${((p.priceUSD ?? p.price ?? 0) / (p.priceUSD ? 1 : 10000)).toFixed(2)}</td>
          <td style="padding:4px 12px">
            <a style="color:#ff6600" href="?key=${encodeURIComponent(apiKey)}&package=${encodeURIComponent(p.packageCode)}">
              Test Buy
            </a>
          </td>
        </tr>`
      ).join("");

      return new Response(
        `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ccc">
          <h2 style="color:#ff6600">PikaSim Buy Test — Pick a Package</h2>
          <p style="color:#f90">⚠ This will charge your PikaSim reseller balance — but NO crypto needed.</p>
          <p>Showing first 10 Japan packages. Click "Test Buy" to purchase.</p>
          <table border="1" style="border-collapse:collapse;color:#ccc">
            <tr style="color:#fff"><th>Code</th><th>Name</th><th>Price</th><th>Action</th></tr>
            ${rows || "<tr><td colspan=4>No packages found — check PIKASIM_API_KEY</td></tr>"}
          </table>
        </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    } catch (err) {
      return new Response(
        `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#f44">
          <h2>Error loading packages</h2><pre>${String(err)}</pre>
        </body></html>`,
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }
  }

  // Step 2: call purchase_esim with the chosen package code
  const startMs = Date.now();
  let pikaRaw: unknown;
  let pikaStatus = 0;
  let pikaError: string | null = null;

  try {
    const res = await fetch("https://pikasim.com/agentic-esim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: "purchase_esim", arguments: { packageCode } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    pikaStatus = res.status;
    const text = await res.text();
    try { pikaRaw = JSON.parse(text); } catch { pikaRaw = text.slice(0, 1000); }
  } catch (err) {
    pikaError = String(err);
  }

  const elapsed = Date.now() - startMs;
  const pretty = JSON.stringify(pikaRaw, null, 2) ?? "";

  // Extract ICCID from response if present
  const raw = pikaRaw as Record<string, unknown> | null;
  let iccid = "";
  let activationCode = "";
  try {
    const result = (raw?.result ?? raw) as Record<string, unknown>;
    // Handle content-block wrapping
    if (Array.isArray((result as { content?: unknown[] })?.content)) {
      const block = ((result as { content: { type: string; text?: string }[] }).content).find(b => b.type === "text" && b.text);
      if (block?.text) {
        const inner = JSON.parse(block.text) as Record<string, unknown>;
        iccid = String(inner.iccid ?? inner.ICCID ?? "");
        activationCode = String(inner.activationCode ?? inner.activation_code ?? "");
      }
    } else {
      iccid = String(result?.iccid ?? result?.ICCID ?? "");
      activationCode = String(result?.activationCode ?? result?.activation_code ?? "");
    }
  } catch { /* ignore */ }

  const success = !!iccid && !!activationCode;

  return new Response(
    `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ccc">
      <h2 style="color:${success ? "#0f0" : "#f44"}">
        ${success ? "✓ eSIM Purchased Successfully!" : "✗ Purchase Failed"}
      </h2>
      <p>Package: <b style="color:#fff">${packageCode}</b> — took ${elapsed}ms — HTTP ${pikaStatus}</p>
      ${pikaError ? `<p style="color:#f44">Network error: ${pikaError}</p>` : ""}
      ${success ? `
        <div style="background:#1a2;padding:1rem;border-radius:8px;margin:1rem 0">
          <p><b style="color:#0f0">ICCID:</b> <span style="color:#fff">${iccid}</span></p>
          <p><b style="color:#0f0">Activation Code:</b> <span style="color:#fff">${activationCode}</span></p>
        </div>
        <p style="color:#0f0">✓ The full purchase flow works! Real customers will receive these codes after paying.</p>
      ` : `
        <p style="color:#f90">See raw response below to diagnose the issue:</p>
      `}
      <details open>
        <summary style="cursor:pointer;color:#ff6600">Raw PikaSim Response</summary>
        <pre style="color:#aaa;white-space:pre-wrap">${pretty}</pre>
      </details>
      <br><a style="color:#ff6600" href="?key=${encodeURIComponent(apiKey)}">← Back to package list</a>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
