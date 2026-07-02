import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { searchEsimPackages } from "@/lib/pikasim";
import { detectCountry, countryName } from "@/lib/countries";

// ARIA — keyless assistant. Intent-matched answers grounded in live package
// data from PikaSim. No external AI API required, so it always works.

const CHAT_RATE_LIMIT = { windowMs: 60_000, max: 20 };
const MARKUP = 1.5;

function usd(n: number): string {
  return `$${(Math.ceil(n * MARKUP * 100) / 100).toFixed(2)}`;
}

async function answerCountryQuery(code: string, wantsPhone: boolean): Promise<string> {
  const name = countryName(code);
  try {
    const packages = await searchEsimPackages(code, wantsPhone ? "phone" : "data");
    if (packages.length === 0) {
      return `I couldn't find ${wantsPhone ? "phone" : "data"} plans for ${name} right now. Browse all destinations at [/shop](/shop) — coverage changes often.`;
    }
    const sorted = [...packages].sort((a, b) => a.priceUsd - b.priceUsd);
    const top = sorted.slice(0, 3);
    const lines = top.map(
      (p) => `• **${p.dataAmount}** for ${p.durationDays} days — ${usd(p.priceUsd)}`
    );
    return [
      `Here are the cheapest ${wantsPhone ? "phone" : "data"} plans for **${name}** right now:`,
      ...lines,
      ``,
      `${packages.length} plans available in total — see them all at [/shop/${code}](/shop/${code}). Pay with Monero or Ethereum, no account needed.`,
    ].join("\n");
  } catch {
    return `I couldn't reach live pricing just now. See all ${name} plans at [/shop/${code}](/shop/${code}).`;
  }
}

type Rule = { test: RegExp; reply: string };

const RULES: Rule[] = [
  {
    test: /\b(hi|hello|hey|good (morning|afternoon|evening)|yo|sup)\b/i,
    reply:
      "Hi! I'm ARIA, your anonymous eSIM guide. Ask me things like:\n• \"eSIM for Japan\" — live plans and prices\n• \"How do I pay with Monero?\"\n• \"Will my iPhone work?\"\n• \"Where is my order?\"",
  },
  {
    test: /\b(how|where).{0,30}\b(buy|purchase|order|get)\b|\bhow does (this|it) work\b/i,
    reply:
      "Buying takes ~2 minutes and zero personal info:\n1. Pick your destination at [/shop](/shop)\n2. Choose a plan and hit **Buy Now**\n3. Pay with Monero (most private) or Ethereum\n4. Send the exact amount to the address shown\n5. After blockchain confirmation (~30s ETH, 2–10 min XMR) your eSIM QR code appears — also saved on [/orders](/orders)",
  },
  {
    test: /\bmonero|xmr\b/i,
    reply:
      "**Monero (XMR)** is our most private option — stealth addresses and ring signatures make payments untraceable.\n\nHow: at checkout choose Monero, then send the exact XMR amount from any wallet (Cake Wallet, Feather, Monerujo). Scan the QR or copy the address. Delivery after ~10 confirmations (2–10 minutes).",
  },
  {
    test: /\bethereum|\beth\b|metamask/i,
    reply:
      "**Ethereum (ETH)** confirms fast (~30 seconds).\n\nImportant:\n• Send **ETH on Ethereum Mainnet** (chain ID 1) only\n• Do **not** send USDT, USDC, BNB or use other chains\n• Any wallet works: MetaMask, Trust Wallet, hardware wallets\n\nAfter sending, paste your transaction hash on the order page to claim your eSIM instantly.",
  },
  {
    test: /\b(bitcoin|btc|usdt|usdc|paypal|credit card|visa|mastercard|apple pay|google pay)\b/i,
    reply:
      "We only accept **Monero (XMR)** and **Ethereum (ETH)** — they let us sell without collecting any identity. Bitcoin, stablecoins, cards, and PayPal aren't supported. If you hold other crypto, a quick swap to XMR or ETH on any exchange works.",
  },
  {
    test: /\b(device|phone|iphone|android|samsung|pixel|compatib|support(s|ed)?|work (on|with))\b/i,
    reply:
      "Your device needs to be **eSIM-capable and carrier-unlocked**:\n• iPhone XS or newer (2018+)\n• Samsung Galaxy S20 and newer\n• Google Pixel 3 and newer\n• Most flagship Androids from 2020+\n\nQuick check: dial `*#06#` — if you see an EID number, your phone supports eSIM.",
  },
  {
    test: /\b(install|activat|qr code|set ?up|scan|add (the )?esim)\b/i,
    reply:
      "Installing your eSIM (needs Wi-Fi):\n\n**iPhone:** Settings → Cellular → Add eSIM → scan the QR code\n**Android:** Settings → Network → SIMs → Add eSIM → scan the QR\n\nThen enable **data roaming** for the new line when you arrive. Activation codes are single-use — don't share them. Full guide: [/blog/esim-installation-guide](/blog/esim-installation-guide).",
  },
  {
    test: /\b(order|status|track|where.{0,15}(esim|order)|not (arriv|receiv|deliver)|still waiting|didn'?t (get|arrive|come))\b/i,
    reply:
      "Track your order at [/orders](/orders) — it's stored in your browser, no account needed.\n\n• **Pending** — waiting for blockchain confirmation (~30s ETH, 2–10 min XMR)\n• **Processing** — payment confirmed, eSIM being provisioned (30–60s)\n• **Delivered** — QR code and activation code shown\n\nIf you paid but see nothing after 10 minutes, open your order and paste your transaction hash to claim delivery.",
  },
  {
    test: /\brefund|cancel|money back|return\b/i,
    reply:
      "eSIMs are provisioned instantly and activation codes are single-use, so **completed orders can't be refunded**. If your payment went through but the eSIM failed to deliver, use [/orders](/orders) to retry with your transaction hash — payment is never lost.",
  },
  {
    test: /\b(privacy|anonym|kyc|identity|tracking|log(s|ging)?|data (do you|you) (collect|store)|email|account|sign ?up|register)\b/i,
    reply:
      "PRIVASIM is built for privacy:\n• **No account, email, or phone number** — ever\n• **No KYC** — we never ask who you are\n• Payments in Monero/Ethereum, not cards\n• eSIM credentials encrypted with AES-256-GCM\n• No cookies, no trackers, no third-party analytics\n\nOrders are tied to your browser only. Read more: [/privacy](/privacy).",
  },
  {
    test: /\b(top ?up|refill|extend|add (more )?data|ran out|used up)\b/i,
    reply:
      "Many plans support top-ups — buying the same package again before expiry extends your plan. Grab another plan for your destination at [/shop](/shop); phone plans keep the same number when topped up.",
  },
  {
    test: /\b(call|voice|sms|text|phone number|real number)\b/i,
    reply:
      "Most of our eSIMs are **data-only**. For calling and SMS with a real phone number, look for **Phone Plans** on a country's page — use the Phone filter at [/shop](/shop). Data eSIMs still work fine with WhatsApp, Signal, and Telegram calls.",
  },
  {
    test: /\b(price|cost|cheap|how much|pricing)\b/i,
    reply:
      "Rough guide: 1GB plans from ~$5, 5GB from ~$12, 10GB from ~$20 — varies by country. Tell me a destination (e.g. \"eSIM for Japan\") and I'll pull live prices, or browse [/shop](/shop).",
  },
  {
    test: /\b(countr|coverage|where (do|can)|destinations?|region)\b/i,
    reply:
      "We cover **190+ countries** — Asia, Europe, Americas, Middle East, Africa, plus regional and global plans. Name a country (e.g. \"Thailand\") and I'll show live plans, or browse everything at [/shop](/shop).",
  },
  {
    test: /\b(problem|issue|help|support|broken|doesn'?t work|not working|error|fail)\b/i,
    reply:
      "Sorry about that — let's fix it:\n• **eSIM won't install?** Check the device is unlocked and eSIM-capable (dial `*#06#`)\n• **No data abroad?** Enable data roaming on the eSIM line\n• **Payment sent but no eSIM?** Go to [/orders](/orders) and paste your transaction hash\n• **Other issue?** Check [/blog/esim-troubleshooting-guide](/blog/esim-troubleshooting-guide)\n\nWhat exactly is happening?",
  },
  {
    test: /\b(thank|thanks|thx|cheers|great|awesome|perfect)\b/i,
    reply: "You're welcome! Safe travels — and remember, no one needs to know where you're going. 🌍",
  },
];

const FALLBACK =
  "I can help with plans and prices (\"eSIM for Japan\"), payments (Monero/Ethereum), device compatibility, installation, and order tracking. What would you like to know? You can also browse [/shop](/shop) directly.";

async function generateReply(text: string): Promise<string> {
  const country = detectCountry(text);
  const wantsPhone = /\b(phone plan|voice|call|sms|number)\b/i.test(text);

  // Country + plan intent takes priority — grounded in live data
  if (country && /\b(esim|plan|data|sim|internet|travel|going|trip|visit|for)\b/i.test(text)) {
    return answerCountryQuery(country, wantsPhone);
  }

  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.reply;
  }

  // Bare country name with no other intent
  if (country) return answerCountryQuery(country, wantsPhone);

  return FALLBACK;
}

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
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content ?? "").slice(0, 500);

  const reply = await generateReply(text);

  // Stream in small chunks so the client's typing effect still works
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const words = reply.split(/(?<=\s)/);
      for (let i = 0; i < words.length; i += 4) {
        controller.enqueue(encoder.encode(words.slice(i, i + 4).join("")));
        await new Promise((r) => setTimeout(r, 20));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
