// Blog content — static, versioned in git, rendered server-side.
// Content is HTML (rendered with dangerouslySetInnerHTML in app/blog/[slug]).
// The "daily deals" post regenerates automatically: a scheduled workflow
// (.github/workflows/daily-deals.yml) refreshes data/daily-deals.json from
// the live catalog every day and pushes, which redeploys the site.

import dealsData from "@/data/daily-deals.json";
import { retailPrice } from "@/lib/prices";
import { countryName } from "@/lib/countries";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  updated_at?: string;
  featured: boolean;
  tags: string[];
  excerpt: string;
  content: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "1",
    slug: "why-privacy-matters-esim",
    title: "Why Privacy Matters When Buying an eSIM",
    published_at: "2024-11-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    featured: true,
    tags: ["privacy", "esim"],
    excerpt:
      "Traditional eSIM providers require your passport, email, and payment card — all permanently tied to your identity. Here's what they collect, why it matters, and how to opt out.",
    content: `
<p>Buy an eSIM from a mainstream provider and you hand over far more than money. Most services require an email address, a payment card, and in many countries a passport scan for SIM registration. Every one of those data points is stored, linked, and — sooner or later — shared or breached.</p>
<h2>What a typical eSIM purchase reveals about you</h2>
<ul>
<li><strong>Your identity</strong> — name and billing address from the card, government ID where SIM registration laws apply.</li>
<li><strong>Your travel plans</strong> — the country you bought data for and your activation date describe your itinerary precisely.</li>
<li><strong>Your movements</strong> — the ICCID issued to you is tied to your account, so network-level records can be joined back to your identity.</li>
<li><strong>Your habits</strong> — marketing analytics, cross-site trackers, and "personalization" follow most checkout flows.</li>
</ul>
<h2>Why this data is dangerous, not just annoying</h2>
<p>Telecom purchase records have been subpoenaed, leaked, and sold. Data brokers buy travel-intent data. A breached eSIM vendor exposes not just emails but passports paired with movement history. For journalists, activists, executives, and anyone crossing borders, that linkage is a genuine safety problem — and for everyone else it's surveillance nobody asked for.</p>
<h2>The PRIVASIM approach: collect nothing</h2>
<p>We designed the purchase flow so there is nothing to leak:</p>
<ul>
<li><strong>No account, no email, no phone number.</strong> There is no sign-up form anywhere on the site.</li>
<li><strong>Crypto-only payments.</strong> Monero (untraceable by design) or Ethereum — never a card with your name on it.</li>
<li><strong>Encrypted credentials.</strong> Your eSIM activation code is stored encrypted with AES-256-GCM and shown only to your browser.</li>
<li><strong>No trackers.</strong> No advertising pixels, no fingerprinting, no third-party analytics scripts.</li>
</ul>
<p>The result: you get connectivity in 190+ countries, and the only party who knows you bought it is you.</p>
<p><a href="/shop">Browse anonymous eSIM plans →</a></p>
`,
  },
  {
    id: "2",
    slug: "monero-vs-ethereum-payments",
    title: "Monero vs Ethereum: Which Payment Is More Private?",
    published_at: "2024-11-15T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    featured: false,
    tags: ["monero", "ethereum", "payments", "privacy"],
    excerpt:
      "Both cryptocurrencies beat credit cards for privacy, but they are not equal. A practical comparison of XMR and ETH for anonymous purchases.",
    content: `
<p>PRIVASIM accepts two cryptocurrencies, and people regularly ask which one to use. The short answer: <strong>Monero if privacy is your priority, Ethereum if speed and convenience matter more.</strong> Here's the long answer.</p>
<h2>Monero (XMR): private by default</h2>
<p>Monero was engineered so that every transaction hides its sender, receiver, and amount:</p>
<ul>
<li><strong>Ring signatures</strong> mix your transaction with decoys, so an observer cannot tell which input is really yours.</li>
<li><strong>Stealth addresses</strong> generate a one-time destination for every payment — nothing on-chain links back to a public address.</li>
<li><strong>RingCT</strong> hides the amount transferred.</li>
</ul>
<p>There is no "transparent mode." Privacy is not optional, which means even a careless user gets strong guarantees. The trade-off: confirmations take 2–10 minutes, and fewer exchanges list XMR.</p>
<h2>Ethereum (ETH): fast, public, but card-free</h2>
<p>Ethereum's ledger is fully transparent — anyone can see that address A sent 0.01 ETH to address B. What it still gives you over a credit card:</p>
<ul>
<li><strong>No identity attached at purchase.</strong> We see a wallet address, not a name or billing address.</li>
<li><strong>~30-second confirmations</strong> — your eSIM arrives almost instantly.</li>
<li><strong>Universal availability</strong> — every exchange and wallet supports ETH.</li>
</ul>
<p>If you use a fresh wallet funded without KYC, ETH payments are reasonably private. If your wallet is linked to a KYC exchange account, the purchase is traceable to you by anyone with subpoena power.</p>
<h2>Practical recommendation</h2>
<table>
<tr><th></th><th>Monero</th><th>Ethereum</th></tr>
<tr><td>Privacy</td><td>Untraceable by design</td><td>Public ledger, pseudonymous</td></tr>
<tr><td>Speed</td><td>2–10 min</td><td>~30 sec</td></tr>
<tr><td>Best for</td><td>Maximum anonymity</td><td>Speed and convenience</td></tr>
</table>
<p>Either way, you never create an account and never show ID. <a href="/shop">Pick a plan and choose your payment at checkout →</a></p>
`,
  },
  {
    id: "3",
    slug: "how-esim-works-privacy",
    title: "How eSIM Technology Works and What Data It Exposes",
    published_at: "2024-12-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    featured: false,
    tags: ["esim", "technology", "privacy"],
    excerpt:
      "An eSIM is a carrier profile downloaded into a secure chip in your phone. Understanding the moving parts — ICCID, IMSI, SM-DP+ — tells you exactly what is and isn't visible.",
    content: `
<p>An eSIM (embedded SIM) replaces the plastic chip with a carrier profile downloaded straight into a secure element soldered inside your phone. Understanding how activation works clarifies what a privacy-focused seller can and cannot protect.</p>
<h2>The moving parts</h2>
<ul>
<li><strong>eUICC</strong> — the reprogrammable secure chip in your device that stores one or more carrier profiles.</li>
<li><strong>SM-DP+</strong> — the carrier's provisioning server. Your QR code is essentially the address of this server plus a one-time download token.</li>
<li><strong>ICCID</strong> — the serial number of the downloaded profile.</li>
<li><strong>IMSI</strong> — the subscriber identity the network uses to route your traffic.</li>
</ul>
<h2>What the carrier network necessarily sees</h2>
<p>Once you connect, the mobile network knows your ICCID/IMSI, your device's IMEI, and which cell towers you touch — that is inherent to how cellular works, with any SIM from any seller. What is <em>not</em> inherent is the link between those identifiers and <strong>you as a person</strong>. That link is created at the point of sale — by ID checks, card payments, and account records.</p>
<h2>Where PRIVASIM breaks the chain</h2>
<p>We remove the point-of-sale linkage entirely:</p>
<ul>
<li>Payment arrives from a crypto wallet, not a named card.</li>
<li>No account or email joins your purchase to an identity.</li>
<li>We store your ICCID and activation code <strong>encrypted (AES-256-GCM)</strong>, keyed to a random order ID that lives in your browser.</li>
</ul>
<p>So while the network sees "a device with profile X connected in Tokyo," neither the carrier nor anyone else can resolve profile X to a name. That's the practical meaning of an anonymous eSIM.</p>
<p><a href="/blog/esim-installation-guide">Next: how to install your eSIM →</a></p>
`,
  },
  {
    id: "4",
    slug: "how-to-buy-esim-with-monero",
    title: "How to Buy an eSIM with Monero (Step-by-Step Guide)",
    published_at: "2026-06-20T00:00:00Z",
    featured: true,
    tags: ["monero", "guide", "esim"],
    excerpt:
      "A complete walkthrough: getting XMR, choosing a plan, paying from Cake Wallet or Feather, and installing your eSIM — with zero identity exposed.",
    content: `
<p>This guide takes you from "I have no Monero" to "my phone has anonymous data in another country" in about 15 minutes.</p>
<h2>Step 1 — Get Monero</h2>
<p>If you don't hold XMR yet, common options:</p>
<ul>
<li><strong>Non-KYC swap services</strong> — swap BTC/ETH/USDT to XMR without an account.</li>
<li><strong>Exchanges</strong> — buy XMR where listed, then withdraw to your own wallet (withdrawing breaks the direct link to your account activity, though the exchange still knows you bought XMR).</li>
<li><strong>P2P markets</strong> — the most private route for acquiring XMR.</li>
</ul>
<p>Recommended wallets: <strong>Cake Wallet</strong> (iOS/Android), <strong>Feather</strong> (desktop), <strong>Monerujo</strong> (Android).</p>
<h2>Step 2 — Pick your plan</h2>
<p>Go to <a href="/shop">/shop</a>, choose your destination country, and compare plans by data amount, duration, and price. Prices shown are final — no hidden fees at checkout.</p>
<h2>Step 3 — Pay</h2>
<ol>
<li>On the checkout page choose <strong>Monero</strong>.</li>
<li>You'll see an XMR address, the exact amount, and a QR code. The invoice is valid for 15 minutes.</li>
<li>In your wallet, scan the QR (amount pre-filled) or paste the address and amount manually. Send.</li>
</ol>
<p>Monero needs ~10 confirmations — typically <strong>2 to 10 minutes</strong>. Keep the order page open, or find it later under <a href="/orders">/orders</a>.</p>
<h2>Step 4 — Receive and install</h2>
<p>Once payment confirms, your QR activation code appears on the order page. Install it under Settings → Cellular/Network → Add eSIM (full instructions: <a href="/blog/esim-installation-guide">installation guide</a>). Done — connectivity with no name attached.</p>
<h2>Troubleshooting</h2>
<ul>
<li><strong>Sent slightly wrong amount?</strong> Small differences are tolerated; large ones aren't. Send the exact figure shown.</li>
<li><strong>Invoice expired mid-payment?</strong> Your funds are safe — open your order at <a href="/orders">/orders</a> and submit the transaction hash to claim delivery.</li>
</ul>
<p><a href="/shop">Start with a plan →</a></p>
`,
  },
  {
    id: "5",
    slug: "no-kyc-esim-complete-guide",
    title: "No-KYC eSIMs: The Complete 2026 Guide",
    published_at: "2026-06-22T00:00:00Z",
    featured: false,
    tags: ["kyc", "privacy", "esim"],
    excerpt:
      "SIM registration laws now cover most of the world — but travel eSIMs remain a legal gap. What KYC means, where it applies, and how no-KYC eSIMs work.",
    content: `
<p>"KYC" (Know Your Customer) started as banking regulation and crept into telecoms: more than 150 countries now have some form of SIM registration law requiring ID to activate a local SIM card. Travel eSIMs are the notable exception — and that's what makes anonymous connectivity still possible in 2026.</p>
<h2>Why travel eSIMs escape SIM registration</h2>
<p>Registration laws bind <em>local carriers</em> issuing <em>local subscriptions</em>. A travel eSIM is typically a roaming profile issued in one jurisdiction and used in another. The regulatory burden sits with the issuing operator, not you — so no passport scan at a kiosk, no registration desk at the airport.</p>
<h2>What "no-KYC" actually means here</h2>
<ul>
<li><strong>No identity documents</strong> — we never ask for ID, and there's nowhere to upload one.</li>
<li><strong>No account</strong> — orders are tracked by a random ID in your browser, not a login.</li>
<li><strong>No payment identity</strong> — crypto only; a card number is itself a KYC document.</li>
</ul>
<h2>Legitimate reasons people choose no-KYC connectivity</h2>
<ul>
<li>Journalists and sources protecting communications metadata.</li>
<li>Travelers to countries with intrusive registration regimes.</li>
<li>Executives avoiding corporate-espionage exposure.</li>
<li>Ordinary people who simply object to handing a passport to a phone company.</li>
</ul>
<h2>Limits to understand</h2>
<p>An anonymous eSIM anonymizes the <strong>purchase</strong>, not physics: cell networks still see a device and its location while connected, and your traffic should still ride a VPN if content privacy matters. Combine an anonymous eSIM + VPN + sensible OPSEC for the full stack.</p>
<p><a href="/shop">Get a no-KYC eSIM →</a></p>
`,
  },
  {
    id: "6",
    slug: "esim-installation-guide",
    title: "eSIM Installation Guide: iPhone & Android (2026)",
    published_at: "2026-06-24T00:00:00Z",
    featured: false,
    tags: ["guide", "esim", "installation"],
    excerpt:
      "Exactly how to install and activate your eSIM on iPhone and Android, what settings to enable when you land, and the mistakes that break activation.",
    content: `
<p>You've got your QR code from <a href="/orders">/orders</a> — here's how to get online. You need <strong>Wi-Fi for the installation step</strong>, so do this before you fly or on hotel Wi-Fi.</p>
<h2>iPhone (iOS 16+)</h2>
<ol>
<li>Open <strong>Settings → Cellular → Add eSIM</strong>.</li>
<li>Choose <strong>Use QR Code</strong> and scan the code from your order page (displaying it on another screen, or use "Enter Details Manually" with the activation code).</li>
<li>Label the new line (e.g. "Travel"), keep your primary line for calls/iMessage.</li>
<li>Set <strong>Cellular Data → your new eSIM</strong> when you arrive.</li>
<li>Enable <strong>Settings → Cellular → [eSIM] → Data Roaming</strong>. Travel eSIMs are roaming profiles — this switch is required.</li>
</ol>
<h2>Android (Pixel / Samsung / others)</h2>
<ol>
<li><strong>Pixel:</strong> Settings → Network &amp; Internet → SIMs → <strong>Add eSIM</strong>.<br/><strong>Samsung:</strong> Settings → Connections → SIM Manager → <strong>Add eSIM</strong>.</li>
<li>Scan the QR code.</li>
<li>Enable the new eSIM and select it for <strong>mobile data</strong>.</li>
<li>Turn on <strong>data roaming</strong> for that SIM.</li>
</ol>
<h2>Common mistakes that break activation</h2>
<ul>
<li><strong>Installing twice.</strong> Activation codes are single-use. Never delete the profile to "reinstall" — deletion consumes it permanently.</li>
<li><strong>Roaming off.</strong> The #1 cause of "installed but no internet."</li>
<li><strong>Locked device.</strong> Carrier-financed phones are often SIM-locked; check with your carrier before traveling.</li>
<li><strong>Activating too early.</strong> Some plans start counting validity at install — check the plan description; when in doubt install before you fly but keep the line off until landing.</li>
</ul>
<h2>Quick compatibility check</h2>
<p>Dial <code>*#06#</code> — if an <strong>EID</strong> appears, your phone supports eSIM. iPhone XS+ (2018), Galaxy S20+, Pixel 3+ and most 2020+ flagships qualify.</p>
<p>Trouble anyway? See the <a href="/blog/esim-troubleshooting-guide">troubleshooting guide</a>.</p>
`,
  },
  {
    id: "7",
    slug: "esim-troubleshooting-guide",
    title: "eSIM Not Working? Troubleshooting Every Common Problem",
    published_at: "2026-06-25T00:00:00Z",
    featured: false,
    tags: ["guide", "esim", "troubleshooting"],
    excerpt:
      "No signal, no data, QR won't scan, 'invalid activation code' — a systematic fix list for every common eSIM failure, in the order you should try them.",
    content: `
<p>Work through these in order — the first three fix the vast majority of cases.</p>
<h2>1. "Installed, but no internet"</h2>
<ol>
<li><strong>Data roaming ON</strong> for the eSIM line (Settings → Cellular/Connections). Travel eSIMs are roaming profiles; this is mandatory.</li>
<li><strong>Mobile data source = the eSIM</strong>, not your home SIM.</li>
<li><strong>Restart the phone.</strong> Genuinely fixes network registration issues.</li>
<li><strong>Select a network manually.</strong> Settings → network selection → choose a listed carrier — some plans only work on specific local networks.</li>
<li><strong>Check APN.</strong> Rarely needed; if your plan documentation lists an APN, set it manually.</li>
</ol>
<h2>2. "QR code won't scan"</h2>
<ul>
<li>Display the QR on a second screen — a phone can't scan a code shown on itself.</li>
<li>Or use manual entry: choose "Enter details manually" and paste the SM-DP+ address and activation code from your <a href="/orders">order page</a>.</li>
</ul>
<h2>3. "Invalid activation code / profile could not be downloaded"</h2>
<ul>
<li>Codes are <strong>single-use</strong>. If the profile was ever installed (even on another device) it cannot be installed again.</li>
<li>If it never installed anywhere and still fails, wait 5 minutes and retry on solid Wi-Fi — provisioning servers occasionally lag.</li>
</ul>
<h2>4. "I paid but got no eSIM"</h2>
<ol>
<li>Open <a href="/orders">/orders</a> — your order lives in the browser you bought with.</li>
<li>Status <strong>pending</strong>? Blockchain confirmation takes ~30s (ETH) to 2–10 min (XMR).</li>
<li>Past that? Use <strong>"I've sent the payment"</strong> on the order and paste your transaction hash — verification runs against the blockchain and releases your eSIM immediately.</li>
</ol>
<h2>5. "Slow data"</h2>
<ul>
<li>Toggle airplane mode to re-register on the network.</li>
<li>Try manual network selection — a different local carrier may be faster.</li>
<li>Check whether your plan is throttled after a high-speed allowance (listed on the plan card).</li>
</ul>
<h2>Still stuck?</h2>
<p>Ask ARIA (chat bubble, bottom-right) — it knows plans, devices, and payment flows. And check your device supports eSIM at all: dial <code>*#06#</code> and look for an EID.</p>
`,
  },
  {
    id: "8",
    slug: "best-esim-japan-travel",
    title: "Best eSIM for Japan (2026): Anonymous Data for Your Trip",
    published_at: "2026-06-26T00:00:00Z",
    featured: false,
    tags: ["japan", "travel", "esim"],
    excerpt:
      "Japan travel data, tourist SIM registration reality, how much data you actually need, and how to get connected anonymously before you land.",
    content: `
<p>Japan is one of the world's most connected countries — and one where buying a local SIM as a tourist involves passport registration at the counter. An eSIM bought before you fly skips all of it.</p>
<h2>How much data do you need in Japan?</h2>
<ul>
<li><strong>Light use (maps, messaging, translation):</strong> ~1GB/week. Tabelog and Google Maps are your constant companions.</li>
<li><strong>Normal tourist use (+ social, photos, video calls):</strong> 3–5GB/week.</li>
<li><strong>Heavy use (streaming, hotspot for a laptop):</strong> 10GB+ or an unlimited plan.</li>
</ul>
<p>Free Wi-Fi exists in convenience stores and stations but is patchy street-level — carrying your own data is the difference between wandering confidently and hunting for hotspots.</p>
<h2>Network reality</h2>
<p>Travel eSIMs for Japan ride the major networks (NTT Docomo, SoftBank, KDDI) with excellent urban coverage and strong rural coverage along all tourist corridors — Tokyo, Kyoto, Osaka, Hakone, the shinkansen lines. 5G is common in cities; 4G everywhere else is fast.</p>
<h2>Why buy anonymously</h2>
<p>Local tourist SIMs require passport registration by law. A travel eSIM avoids the registration requirement entirely — and buying it with Monero or Ethereum on PRIVASIM means the purchase isn't linked to your identity either. No airport kiosk queue, no passport photocopy in a shop's filing cabinet.</p>
<h2>Setup for Japan in 3 steps</h2>
<ol>
<li>Buy a Japan plan at <a href="/shop/JP">/shop/JP</a> — pay with XMR or ETH, get your QR instantly.</li>
<li>Install on hotel/home Wi-Fi before departure (<a href="/blog/esim-installation-guide">guide</a>), keep the line off.</li>
<li>Land at Narita/Haneda/KIX → enable the eSIM + data roaming → online before you clear customs.</li>
</ol>
<p><a href="/shop/JP">See live Japan plans and prices →</a></p>
`,
  },
  {
    id: "9",
    slug: "best-esim-europe-travel",
    title: "Best eSIM for Europe (2026): One Plan for 30+ Countries",
    published_at: "2026-06-27T00:00:00Z",
    featured: false,
    tags: ["europe", "travel", "esim"],
    excerpt:
      "Multi-country European trips need a regional eSIM, not a stack of local SIMs. Coverage, data budgeting for EU travel, and anonymous setup.",
    content: `
<p>The classic European trip crosses three or four borders in two weeks. Buying a SIM in every country is a chore even before registration requirements — a regional eSIM covers the whole continent with one QR code.</p>
<h2>Regional vs single-country plans</h2>
<ul>
<li><strong>Regional Europe plans</strong> cover 30+ countries (EU plus UK, Switzerland, and often Turkey/Balkans). One profile, seamless roaming across borders — the right choice for multi-stop trips.</li>
<li><strong>Single-country plans</strong> are cheaper per GB — the right choice if you're two weeks in Spain only. Compare both at <a href="/shop">/shop</a>.</li>
</ul>
<h2>Data budgeting for European travel</h2>
<ul>
<li><strong>City-hopping with maps + transit apps:</strong> 3–5GB for two weeks is comfortable.</li>
<li><strong>Remote work / heavy social:</strong> 10–20GB.</li>
<li>Hotel and cafe Wi-Fi are ubiquitous in Western Europe, so cellular is mostly for the street.</li>
</ul>
<h2>Registration and privacy in Europe</h2>
<p>Several European countries (Germany, Spain, Italy, Greece among them) legally require ID to buy a local SIM. Travel eSIMs sidestep the requirement — and buying with crypto on PRIVASIM keeps the transaction itself anonymous too. No account, no email, no card statement listing your telecom purchases.</p>
<h2>Practical tips</h2>
<ul>
<li>Install before departure on Wi-Fi; activate on landing.</li>
<li>Watch for plans that throttle after a high-speed cap — fine for maps, painful for tethering.</li>
<li>Trains between countries: your eSIM re-registers automatically at the border; a brief signal gap is normal.</li>
</ul>
<p><a href="/shop">Compare Europe eSIM plans →</a></p>
`,
  },
  {
    id: "10",
    slug: "anonymous-esim-for-journalists-activists",
    title: "Anonymous eSIMs for Journalists, Activists, and High-Risk Travelers",
    published_at: "2026-06-28T00:00:00Z",
    featured: false,
    tags: ["privacy", "opsec", "esim"],
    excerpt:
      "When a SIM purchase can identify a source or expose a movement pattern, procurement is part of your threat model. A practical OPSEC guide to anonymous connectivity.",
    content: `
<p>For most people an anonymous eSIM is a preference. For journalists protecting sources, activists in hostile jurisdictions, and researchers crossing certain borders, the paper trail from a SIM purchase is an operational risk. This guide treats connectivity as part of the threat model.</p>
<h2>What the adversary gets from a normal SIM purchase</h2>
<ul>
<li>Identity-to-number mapping (from registration or payment records).</li>
<li>Location history joined to that identity via the network.</li>
<li>Contact graph — who you called, when, from where — available by subpoena or worse.</li>
</ul>
<h2>Layered approach</h2>
<ol>
<li><strong>Anonymous procurement.</strong> Buy the eSIM with Monero from a provider that holds no identity (that's this site: no account, no email, crypto only, credentials encrypted at rest).</li>
<li><strong>Anonymous funding.</strong> XMR acquired P2P or swapped non-KYC. Avoid paying from a KYC-exchange wallet if linkage matters.</li>
<li><strong>Traffic protection.</strong> The eSIM anonymizes the purchase; a VPN or Tor protects content and destination metadata from the local network.</li>
<li><strong>Device hygiene.</strong> Consider a dedicated travel device; your IMEI is visible to networks and links profiles installed on the same hardware.</li>
<li><strong>Compartmentalization.</strong> Don't install the anonymous profile on the phone logged into your public identity if the two must never meet.</li>
</ol>
<h2>What an anonymous eSIM does NOT do</h2>
<p>Be precise about guarantees: the network still observes the device's location while connected, and traffic is only as private as its encryption. Anonymous eSIM breaks the <em>purchase-to-identity</em> link — combine it with the layers above for the rest.</p>
<h2>Practical notes</h2>
<ul>
<li>Orders here are retrievable by a random ID stored in your browser — export/save your activation details securely once delivered.</li>
<li>Activation codes are single-use; treat them like one-time pads.</li>
<li>Test the full setup at home before it matters in the field.</li>
</ul>
<p><a href="/shop">Procure anonymously →</a></p>
`,
  },
];

// Auto-generated daily post built from the live-refreshed deals data.
function dailyDealsPost(): BlogPost {
  const { date, deals } = dealsData as {
    date: string;
    deals: { countryCode: string; country: string; name: string; dataAmount: string; days: number; wholesaleUsd: number }[];
  };

  const rows = deals
    .map(
      (d) =>
        `<tr><td><strong>${countryName(d.countryCode)}</strong></td><td>${d.dataAmount}</td><td>${d.days} days</td><td>$${retailPrice(d.wholesaleUsd).toFixed(2)}</td><td><a href="/shop/${d.countryCode}">See plans →</a></td></tr>`
    )
    .join("");

  return {
    id: "daily-deals",
    slug: "best-esim-deals-today",
    title: "Today's Best eSIM Deals — Updated Daily",
    published_at: `${date}T06:00:00Z`,
    updated_at: `${date}T06:00:00Z`,
    featured: true,
    tags: ["deals", "esim", "daily"],
    excerpt: `The best value-per-GB eSIM plans across popular destinations, refreshed automatically every day. Last updated ${date}.`,
    content: `
<p>These are the best value-per-gigabyte eSIM plans in our catalog right now, ranked automatically from live pricing. This page refreshes <strong>every day</strong> — bookmark it before your next trip. All prices are final: pay with Monero or Ethereum, no account, no KYC.</p>
<table>
<tr><th>Destination</th><th>Data</th><th>Validity</th><th>Price</th><th></th></tr>
${rows}
</table>
<p><em>Last refreshed: ${date}.</em> Prices update automatically from carrier rates. Every plan delivers instantly after blockchain confirmation — see <a href="/blog/how-to-buy-esim-with-monero">how buying works</a> or <a href="/shop">browse all 190+ countries</a>.</p>
`,
  };
}

function allPosts(): BlogPost[] {
  return [dailyDealsPost(), ...BLOG_POSTS];
}

export function getBlogPosts(limit = 20, offset = 0): BlogPost[] {
  return allPosts()
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(offset, offset + limit);
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return allPosts().find((p) => p.slug === slug) ?? null;
}

export function getAllBlogSlugs(): string[] {
  return allPosts().map((p) => p.slug);
}
