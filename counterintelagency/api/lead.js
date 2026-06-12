/* =====================================================================
   Anonymized lead ingestion endpoint (Vercel serverless function)
   ---------------------------------------------------------------------
   Forwards inquiries to the destination inbox. The address is resolved
   EXCLUSIVELY from server-side environment variables and is never
   present in any client-facing asset.

   Required project env vars (Vercel dashboard or `vercel env add`):
     LEAD_DESTINATION   protected operations inbox
     MAIL_PROVIDER_KEY  transactional mail provider API key (Resend)
     MAIL_FROM          verified sender, e.g. no-reply@counterintelagency.com
   ===================================================================== */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body || {};

  // Honeypot: silently accept-and-drop bot submissions.
  if (body.company_website) return res.status(200).json({ ok: true });

  const email = String(body.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ error: "invalid_email" });
  }

  if (!process.env.LEAD_DESTINATION || !process.env.MAIL_PROVIDER_KEY) {
    return res.status(503).json({ error: "gateway_not_configured" });
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

  try {
    const fwd = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MAIL_PROVIDER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "onboarding@resend.dev",
        to: [process.env.LEAD_DESTINATION],
        reply_to: email,
        subject,
        text: lines,
      }),
    });
    if (!fwd.ok) return res.status(502).json({ error: "forward_failed" });
  } catch {
    return res.status(502).json({ error: "forward_error" });
  }

  return res.status(200).json({ ok: true });
}

function sanitize(v) {
  if (v == null) return "";
  return String(v).replace(/[\r\n]+/g, " ").slice(0, 4000);
}
