import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const SYSTEM_PROMPT = `You are ARIA (Anonymous Roaming Intelligence Assistant), the AI guide for PRIVASIM — a privacy-first eSIM marketplace for travelers and privacy-conscious people worldwide.

About PRIVASIM:
- Sells eSIM data and phone plans for 190+ countries
- Payment: Monero XMR (most private, untraceable) or Ethereum ETH
- Zero KYC — no email, no phone number, no identity required
- Instant eSIM delivery after payment blockchain confirmation
- All eSIM credentials encrypted with AES-256-GCM
- No tracking, no cookies, no analytics, no third-party scripts
- Website: https://dpass.vercel.app

How to buy an eSIM on PRIVASIM:
1. Go to /shop and choose your destination country
2. Pick a data plan (data amount, duration, price)
3. Click "Buy Now" — arrives at checkout
4. Choose Monero (most private) or Ethereum payment
5. Send the exact crypto amount to the payment address shown
6. Wait for blockchain confirmation: ~2–10 min Monero, ~30 sec ETH
7. eSIM activation QR code delivered automatically to your orders page

Payment instructions — Ethereum:
- Send ETH on Ethereum Mainnet (chain ID 1) ONLY
- Do NOT use USDT, USDC, BNB, MATIC or other tokens/chains
- The receiving address starts with 0x (standard ETH address)
- Use MetaMask, Trust Wallet, or any ETH wallet — select "Ethereum" and "ETH"

Payment instructions — Monero:
- Send XMR from any Monero wallet (Cake Wallet, Feather, Monerujo)
- Scan the QR code or copy the XMR address and payment ID
- 10 confirmations required (~2–10 minutes)

Supported devices for eSIM:
- iPhone XS or newer (2018+)
- Samsung Galaxy S20 and newer
- Google Pixel 3 and newer
- Most flagship Android phones from 2020+
- Device must be carrier-unlocked and eSIM-capable

Common questions:
- Do I need an account? No — just a crypto wallet
- Can I check order status? Yes at /orders
- Are plans data-only? Most are data; phone plans available in some countries
- Will the eSIM work for calls? Check the plan type on the product page
- Do I need Wi-Fi to activate? Yes, for the initial eSIM installation
- Can I reuse the eSIM code? No — activation codes are single-use
- Are there refunds? No refunds once the eSIM is provisioned
- What if my eSIM doesn't work? Contact support via the orders page

Pricing examples (from $):
- 500MB plans from ~$3
- 1GB plans from ~$5
- 5GB plans from ~$12
- 10GB plans from ~$20

STYLE RULES:
- Keep responses SHORT (2–4 sentences) unless the user asks for detail
- For prices or availability, say "visit /shop to see live packages"
- Be friendly, helpful, and privacy-conscious
- Never collect personal information from users
- If unsure, say "I don't know — visit /shop or check /orders"
- Use markdown links like [text](url) for internal pages`;

const CHAT_RATE_LIMIT = { windowMs: 60_000, max: 15 };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`chat:${ip}`, CHAT_RATE_LIMIT);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }
    messages = messages.slice(-10);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "AI assistant is not configured. Browse plans at /shop or check /orders for existing orders.",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        stream: true,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("Anthropic error:", res.status, err.slice(0, 200));
      return new Response(
        "I'm having trouble right now. Please browse plans at /shop.",
        { status: 200, headers: { "Content-Type": "text/plain" } }
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                if (
                  event.type === "content_block_delta" &&
                  event.delta?.type === "text_delta" &&
                  event.delta?.text
                ) {
                  controller.enqueue(encoder.encode(event.delta.text));
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return new Response(
      "I'm unavailable right now. Browse eSIM plans at /shop.",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  }
}
