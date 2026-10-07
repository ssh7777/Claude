import { createHmac, timingSafeEqual } from "node:crypto";

export class RequestBodyLimitError extends Error {
  constructor() {
    super("Request body too large");
  }
}

export async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new RequestBodyLimitError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function verifyWebhookHmac(rawBody: string | Uint8Array, signature: string, secret: string): boolean {
  const normalized = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(normalized, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function decodeWebhookBody(rawBody: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  } catch {
    return null;
  }
}
