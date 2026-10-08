import { Metadata } from "next";
import Link from "next/link";
import { Shield, Zap, Globe, Coins, ChevronRight, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pillar landing page for the head keyword "anonymous eSIM" — permanent,
// content-rich, heavily interlinked. Every internal link from the footer,
// blog posts and homepage concentrates ranking signals here.

const APP_URL = "https://privasim.app";

export const metadata: Metadata = {
  title: "Anonymous eSIM — Buy Mobile Data with No ID, No Email, No KYC",
  description:
    "Buy prepaid eSIMs with cryptocurrency, without an identity account. Temporary order records support payment verification and delivery.",
  keywords: [
    "anonymous esim", "anonymous sim card", "esim without id", "no kyc esim",
    "private esim", "esim anonymous payment", "buy esim anonymously", "esim no registration",
  ],
  alternates: { canonical: `${APP_URL}/anonymous-esim` },
    openGraph: {
      title: "Anonymous eSIM — No ID, No Email, No KYC",
      description:
        "Prepaid mobile data for many destinations. No identity account is required; payment and delivery use a temporary order record.",
    url: `${APP_URL}/anonymous-esim`,
    siteName: "PRIVASIM",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Anonymous eSIM",
      provider: { "@type": "Organization", name: "PRIVASIM", url: APP_URL },
      description:
        "Prepaid eSIM data plans for many destinations. Checkout does not require an identity account; temporary order records support payment verification and delivery.",
      areaServed: "Worldwide",
      url: `${APP_URL}/anonymous-esim`,
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is an anonymous eSIM?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PRIVASIM does not require an identity account, email, or ID at checkout. It does retain a temporary server-side invoice for payment verification and fulfillment, while encrypted eSIM credentials are available through a random order token.",
          },
        },
        {
          "@type": "Question",
          name: "Is buying an anonymous eSIM legal?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Rules differ by country, carrier, and intended use. Check local requirements before buying or activating an eSIM; PRIVASIM does not provide legal advice.",
          },
        },
        {
          "@type": "Question",
          name: "How do I pay for an eSIM anonymously?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Monero (XMR), Ethereum (ETH), and USDT on Ethereum mainnet are accepted directly. Additional assets may be available through the external Trocador swap flow. Monero can reduce public-chain visibility but does not guarantee anonymity; the swap provider has separate terms.",
          },
        },
        {
          "@type": "Question",
          name: "Which countries can I get an anonymous eSIM for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A broad range of countries including Japan, USA, UK, Germany, Thailand, UAE and Turkey, plus global plans covering many countries with a single eSIM.",
          },
        },
      ],
    },
  ],
};

const STEPS = [
  { n: "1", title: "Pick a plan", body: "Many countries, current catalog prices, no login wall." },
  { n: "2", title: "Pay with crypto", body: "Monero, ETH, USDT or 100+ coins. Exact amount, one address." },
  { n: "3", title: "Retrieve the eSIM", body: "After payment confirmation and supplier fulfillment, open your order and install the QR code." },
];

export default function AnonymousEsimPage() {
  return (
    <div className="container py-14 max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-[#ff6600]/10 border border-[#ff6600]/30 rounded-full px-4 py-1.5 text-sm text-[#ff9944] mb-5">
          <EyeOff className="h-4 w-4" /> No identity account required at checkout
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">The Anonymous eSIM</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Prepaid mobile data for <strong className="text-white">many countries</strong>, bought with
          crypto and delivered as a QR code. No identity account or email is required. A temporary order record is retained for payment checks and delivery.
        </p>
        <div className="flex justify-center gap-3 mt-7">
          <Button size="lg" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold" asChild>
            <Link href="/shop">Browse plans <ChevronRight className="h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/20 text-white" asChild>
            <Link href="/blog/best-anonymous-esim">Compare providers</Link>
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-14">
        {STEPS.map((s) => (
          <div key={s.n} className="bg-white/4 border border-white/10 rounded-xl p-5">
            <div className="h-8 w-8 rounded-full bg-[#ff6600] text-white font-black flex items-center justify-center mb-3">{s.n}</div>
            <h3 className="font-bold text-white mb-1">{s.title}</h3>
            <p className="text-sm text-gray-400">{s.body}</p>
          </div>
        ))}
      </div>

      <article className="prose prose-invert prose-orange max-w-none text-gray-300 prose-headings:text-white prose-a:text-[#ff6600] mb-14">
        <h2>Why an anonymous eSIM exists</h2>
        <p>
          SIM-registration and eSIM rules vary by country and provider. PRIVASIM checkout does not ask for
          an identity account, email, or payment card, but the service does keep a temporary invoice and
          fulfillment record. Crypto and a no-account checkout can reduce some direct identity links; they
          do not make a purchase or subsequent mobile-network use anonymous in every context.
        </p>
        <h2>How the anonymity actually works</h2>
        <ul>
          <li><strong>No identity account required.</strong> A signed invoice token saved in your browser provides order access; the server keeps a minimal payment and fulfillment record for up to 30 days.</li>
          <li><strong>Crypto payment options.</strong> <Link href="/blog/how-to-buy-esim-with-monero">Monero</Link> provides stronger on-chain privacy than Ethereum or Bitcoin, but no method guarantees anonymity. Other supported coins use a separate swap provider.</li>
          <li><strong>Roaming model.</strong> The plans are legitimate carrier roaming products — the registration burden sits with the home carrier, not with you at a kiosk.</li>
          <li><strong>Honest limits.</strong> The network still sees your device while connected. For full compartmentalization, read the <Link href="/blog/anonymous-esim-for-journalists-activists">high-risk user guide</Link>.</li>
        </ul>
        <h2>Who uses it</h2>
        <p>
          Travelers skipping the SIM-registration queue, journalists protecting sources, crypto holders who
          want to spend coins on something useful, and anyone who thinks a data plan shouldn&apos;t come with a
          dossier. Popular destinations: <Link href="/shop/JP">Japan</Link>, <Link href="/shop/US">USA</Link>,{" "}
          <Link href="/shop/TH">Thailand</Link>, <Link href="/shop/DE">Germany</Link>,{" "}
          <Link href="/shop/AE">UAE</Link>, <Link href="/shop/TR">Turkey</Link> — or one{" "}
          <Link href="/shop/global">global eSIM for many countries</Link>.
        </p>
        <h2>What it costs</h2>
        <p>
          From about $3 for 500 MB to ~$20 for 10 GB depending on country; actual prices vary by destination and
          change over time. See <Link href="/blog/best-esim-deals-today">today&apos;s listed cheapest deals</Link> or the{" "}
          <Link href="/blog/airalo-alternative">Airalo</Link> and{" "}
          <Link href="/blog/holafly-alternative">Holafly</Link> comparisons.
        </p>
      </article>

      <div className="grid sm:grid-cols-3 gap-4 text-center">
        {[
          { icon: Globe, t: "Many countries", d: "incl. global multi-country plans" },
          { icon: Coins, t: "Crypto payments", d: "XMR · ETH · USDT · supported swap assets" },
          { icon: Zap, t: "Digital delivery", d: "After chain confirmation and supplier fulfillment" },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="bg-white/4 border border-white/10 rounded-xl p-5">
            <Icon className="h-6 w-6 text-[#ff6600] mx-auto mb-2" />
            <div className="font-bold text-white">{t}</div>
            <div className="text-xs text-gray-400 mt-1">{d}</div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <Button size="lg" className="bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold h-13 px-10" asChild>
          <Link href="/shop"><Shield className="h-5 w-5 mr-1" /> Get your anonymous eSIM</Link>
        </Button>
      </div>
    </div>
  );
}
