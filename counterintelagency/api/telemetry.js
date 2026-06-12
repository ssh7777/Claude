/* Best-effort telemetry sink. Accept and acknowledge; wire to a real
   analytics store (KV, queue, external endpoint) as required. */

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  return res.status(202).json({ ok: true });
}
