import { NextRequest } from "next/server";
import { searchEsimPackages, purchaseEsim } from "@/lib/pikasim";
import { retailPrice } from "@/lib/prices";

// End-to-end purchase test — exercises the SAME purchaseEsim() pipeline that
// the real crypto checkout uses, so a green result here proves the whole
// provisioning chain works. Bypasses only the crypto payment step.
// Protected by ?key=<PIKASIM_API_KEY>. WARNING: a real purchase spends
// wallet balance.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  const provided = url.searchParams.get("key") ?? req.headers.get("x-test-key") ?? "";
  const packageCode = url.searchParams.get("package") ?? "";
  const country = (url.searchParams.get("country") ?? "JP").toUpperCase();

  if (!apiKey || provided !== apiKey) {
    return new Response(
      `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ff6600">
        <h2>PikaSim Buy Test</h2>
        <p>Usage: <code style="color:#fff">?key=YOUR_PIKASIM_API_KEY&amp;country=JP</code> then click a package.</p>
        <p>Wrong or missing API key.</p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  // Step 1 — list cheapest packages so the operator can pick a low-cost one
  if (!packageCode) {
    let packages: Awaited<ReturnType<typeof searchEsimPackages>> = [];
    try {
      packages = await searchEsimPackages(country, "data");
    } catch (err) {
      return new Response(
        `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#f44">
          <h2>Error loading packages</h2><pre>${String(err)}</pre>
        </body></html>`,
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }
    const rows = [...packages]
      .sort((a, b) => a.priceUsd - b.priceUsd)
      .slice(0, 10)
      .map(
        (p) => `<tr>
          <td style="padding:4px 12px">${p.code}</td>
          <td style="padding:4px 12px">${p.dataAmount} · ${p.durationDays}d</td>
          <td style="padding:4px 12px">wholesale $${p.priceUsd.toFixed(2)} → retail $${retailPrice(p.priceUsd).toFixed(2)}</td>
          <td style="padding:4px 12px"><a style="color:#ff6600" href="?key=${encodeURIComponent(apiKey)}&package=${encodeURIComponent(p.code)}">Test Buy →</a></td>
        </tr>`
      )
      .join("");

    return new Response(
      `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ccc">
        <h2 style="color:#ff6600">End-to-End Buy Test — ${country} (cheapest first)</h2>
        <p style="color:#f90">⚠ Clicking "Test Buy" spends real wallet balance — pick the cheapest.</p>
        <table border="1" style="border-collapse:collapse;color:#ccc">
          <tr style="color:#fff"><th>Code</th><th>Plan</th><th>Price</th><th>Action</th></tr>
          ${rows || "<tr><td colspan=4>No packages — check PIKASIM_API_KEY</td></tr>"}
        </table>
        <p style="color:#888;margin-top:1rem">Try other countries: append <code>&amp;country=US</code> etc.</p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  // Step 2 — real purchase through the production pipeline
  const startMs = Date.now();
  let result: Awaited<ReturnType<typeof purchaseEsim>> | null = null;
  let error: string | null = null;
  try {
    result = await purchaseEsim(packageCode);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const elapsed = Date.now() - startMs;

  const success = !!result && (!!result.iccid || !!result.orderId);
  const delivered = !!result?.iccid && !!result?.activationCode;

  return new Response(
    `<html><body style="font-family:monospace;padding:2rem;background:#111;color:#ccc">
      <h2 style="color:${success ? "#0f0" : "#f44"}">
        ${delivered ? "✓ eSIM Purchased & Delivered!" : success ? "✓ Purchase Accepted (provisioning async)" : "✗ Purchase Failed"}
      </h2>
      <p>Package: <b style="color:#fff">${packageCode}</b> — took ${elapsed}ms</p>
      ${error ? `<p style="color:#f44">Error: ${error}</p>` : ""}
      ${result ? `
        <div style="background:#1a2;padding:1rem;border-radius:8px;margin:1rem 0">
          <p><b style="color:#0f0">Order ID:</b> <span style="color:#fff">${result.orderId || "(async)"}</span></p>
          <p><b style="color:#0f0">ICCID:</b> <span style="color:#fff">${result.iccid || "(pending webhook)"}</span></p>
          <p><b style="color:#0f0">Activation:</b> <span style="color:#fff">${result.activationCode || "(pending)"}</span></p>
          <p><b style="color:#0f0">SM-DP+:</b> <span style="color:#fff">${result.smDpAddress || "-"}</span></p>
          <p><b style="color:#0f0">Status:</b> <span style="color:#fff">${result.status}</span></p>
        </div>
        ${delivered ? `<p style="color:#0f0">✓ Full pipeline works — real customers get these codes after paying.</p>
          ${result.iccid ? `<p><a style="color:#ff6600" href="/esim/${encodeURIComponent(result.iccid)}">Track this eSIM →</a></p>` : ""}` : ""}
      ` : ""}
      <br><a style="color:#ff6600" href="?key=${encodeURIComponent(apiKey)}">← Back to package list</a>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
