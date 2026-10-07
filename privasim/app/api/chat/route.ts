import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { searchEsimPackages } from "@/lib/pikasim";
import { detectCountry, countryName } from "@/lib/countries";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";

// ARIA — keyless assistant. Intent-matched answers grounded in live package
// data from PikaSim. No external AI API required, so it always works.

const CHAT_RATE_LIMIT = { windowMs: 60_000, max: 20 };

function usd(n: number, margin?: number): string {
  return `$${retailPrice(n, margin).toFixed(2)}`;
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
    const margin = await getRetailMargin();
    const lines = top.map(
      (p) => `• **${p.dataAmount}** for ${p.durationDays} days — ${usd(p.priceUsd, margin)}`
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
      "Hi! I'm ARIA, your privacy-focused eSIM guide. Ask me things like:\n• \"eSIM for Japan\" — live plans and prices\n• \"How do I pay with Monero?\"\n• \"Will my iPhone work?\"\n• \"Where is my order?\"",
  },
  {
    test: /\b(how|where).{0,30}\b(buy|purchase|order|get)\b|\bhow does (this|it) work\b/i,
    reply:
      "Checkout does not require an identity account, email, or ID:\n1. Pick a destination at [/shop](/shop)\n2. Choose a plan and select **Buy Now**\n3. Pay with Monero, ETH, USDT, or a supported asset via the external Trocador swap flow\n4. Send the exact amount to the address shown\n5. After the required confirmations and supplier fulfillment, retrieve your eSIM at [/orders](/orders). Keep the invoice token saved in your browser; timings vary.",
  },
  {
    test: /\bmonero|xmr\b/i,
    reply:
      "**Monero (XMR)** is our strongest direct-payment privacy option, but it does not guarantee anonymity: wallet, network, device, and service-provider metadata may still exist. At checkout choose Monero and send the exact amount to the invoice subaddress. Ten confirmations are required; timing depends on network conditions.",
  },
  {
    test: /\bethereum|\beth\b|metamask/i,
    reply:
      "**ETH and USDT** are accepted on Ethereum mainnet (chain ID 1). Ethereum payments require 12 confirmations; timing varies with block production and RPC availability. Send only the asset and amount shown on your invoice—do not use another token or chain. Keep your order token and verify payment from the original order page.",
  },
  {
    test: /\b(bitcoin|btc|usdt|usdc|paypal|credit card|visa|mastercard|apple pay|google pay|other coins)\b/i,
    reply:
      "PRIVASIM accepts Monero (XMR), Ethereum (ETH), and USDT on Ethereum mainnet directly. Additional supported assets may be offered through Trocador, an external swap provider with separate privacy terms and fees. Cards and PayPal are not supported. Check the payment options shown for your specific invoice.",
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
    test: /\b(order|status|track|where.{0,15}(esim|order)|not?t? (arriv|receiv|deliver)\w*|still waiting|didn'?t (get|arrive|come)|paid but)\b/i,
    reply:
      "Open [/orders](/orders) in the same browser where you checked out. The random invoice token is needed to access the server-side order record; keep the token and any delivered codes private.\n\n• **Pending** — awaiting required chain confirmations\n• **Processing** — payment confirmed; supplier fulfillment is in progress\n• **Delivered** — credentials are available\n\nIf payment remains pending, use the transaction-hash verification control on that order page. It still requires the original invoice token. Clearing browser storage can remove your access token.",
  },
  {
    test: /\brefund|cancel|money back|return\b/i,
    reply:
      "Refund eligibility depends on the order status, provider terms, and applicable consumer law; this chatbot cannot decide refund requests. If payment is confirmed but delivery is stuck, keep your invoice token and transaction reference, then contact the service operator. A published support channel must be configured before this site is used for production sales.",
  },
  {
    test: /\b(privacy|anonym|kyc|identity|tracking|log(s|ging)?|data (do you|you) (collect|store)|email|account|sign ?up|register)\b/i,
    reply:
      "PRIVASIM does not require an identity account, email, or ID at checkout. It retains a temporary order record for payment verification and fulfillment; eSIM credentials are encrypted at rest and delivered through a random invoice token saved in your browser. Monero, Ethereum, USDT, and an external swap flow have different privacy properties. No advertising trackers or third-party analytics scripts are used. Read more: [/privacy](/privacy).",
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
      "Sorry about that — let's investigate:\n• **eSIM won't install?** Check the device is unlocked and eSIM-capable (dial `*#06#`)\n• **No data abroad?** Enable data roaming on the eSIM line\n• **Payment sent but no eSIM?** Open [/orders](/orders) in the original browser and use its invoice token; verify with the transaction hash if prompted\n• **Other issue?** Check [/blog/esim-troubleshooting-guide](/blog/esim-troubleshooting-guide)\n\nWhat exactly is happening?",
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
  const { allowed } = await rateLimit(`chat:${ip}`, CHAT_RATE_LIMIT);
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
