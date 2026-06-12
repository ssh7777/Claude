/* =====================================================================
   Counterintel Agency — anonymized ingestion gateway (Cloudflare Worker)
   ---------------------------------------------------------------------
   Receives lead + telemetry payloads from the static front end and
   forwards leads to the destination inbox. The destination address is
   resolved EXCLUSIVELY from environment/secret bindings and is never
   present in any client-facing asset.

   Required bindings (wrangler secrets / vars):
     LEAD_DESTINATION   secret  e.g. the protected operations inbox
     MAIL_PROVIDER_KEY  secret  API key for the transactional mail provider
     MAIL_FROM          var     verified sender, e.g. no-reply@counterintelagency.com
     ALLOWED_ORIGIN     var     e.g. https://counterintelagency.com

   Routes (configure in wrangler.toml):
     POST /api/lead        -> forwards an inquiry to LEAD_DESTINATION
     POST /api/telemetry   -> accepts analytics beacon (store/forward as desired)
   ===================================================================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, env);
    }

    if (url.pathname === "/api/lead") return handleLead(request, env);
    if (url.pathname === "/api/telemetry") return handleTelemetry(request, env);
    return json({ error: "not_found" }, 404, env);
  },
};

async function handleLead(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, env);
  }

  // Honeypot / minimal server-side validation.
  if (body.company_website) return json({ ok: true }, 200, env); // silently drop bots
  const email = String(body.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "invalid_email" }, 422, env);
  }

  const isConsult = body.type === "free_consultation";
  const subject = isConsult
    ? "New Free Consultation Request"
    : `New Secure Audit Inquiry — ${sanitize(body.focus) || "Unspecified"}`;

  const lines = [
    `Type:    ${sanitize(body.type) || "inquiry"}`,
    `Name:    ${sanitize(body.name) || "(not provided)"}`,
    `Email:   ${email}`,
    `Focus:   ${sanitize(body.focus) || "(n/a)"}`,
    `Source:  ${sanitize(body.meta && body.meta.source) || "web"}`,
    `Session: ${sanitize(body.meta && body.meta.session) || "n/a"}`,
    `Time:    ${sanitize(body.meta && body.meta.submittedAt) || new Date().toISOString()}`,
    ``,
    `Message:`,
    `${sanitize(body.message) || "(none)"}`,
  ].join("\n");

  // Forward via a transactional mail API. The destination address comes
  // from env.LEAD_DESTINATION and is never exposed to the browser.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.MAIL_PROVIDER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.LEAD_DESTINATION],
        reply_to: email,
        subject,
        text: lines,
      }),
    });
    if (!res.ok) {
      return json({ error: "forward_failed" }, 502, env);
    }
  } catch {
    return json({ error: "forward_error" }, 502, env);
  }

  return json({ ok: true }, 200, env);
}

async function handleTelemetry(request, env) {
  // Best-effort sink. Accept and acknowledge; persist to your analytics
  // store (KV, Queue, external endpoint) as required.
  try {
    await request.json();
  } catch {
    /* tolerate beacon edge cases */
  }
  return json({ ok: true }, 202, env);
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function sanitize(v) {
  if (v == null) return "";
  return String(v).replace(/[\r\n]+/g, " ").slice(0, 4000);
}
