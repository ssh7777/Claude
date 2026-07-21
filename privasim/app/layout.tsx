import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";
import TrackVisit from "@/components/TrackVisit";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privasim.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a0a1a",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "PRIVASIM — Buy eSIM with Crypto | 190+ Countries, No KYC",
    template: "%s | PRIVASIM",
  },
  description:
    "Buy eSIMs for 190+ countries with Monero or Ethereum. No email. No KYC. No tracking. Instant delivery. The only anonymous eSIM marketplace.",
  keywords: [
    "anonymous esim", "privacy esim", "buy esim crypto", "monero esim", "ethereum esim",
    "no kyc esim", "travel esim", "esim marketplace", "esim without registration",
    "prepaid esim", "international esim", "esim for privacy", "crypto travel sim",
  ],
  authors: [{ name: "PRIVASIM" }],
  creator: "PRIVASIM",
  publisher: "PRIVASIM",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "PRIVASIM",
    title: "PRIVASIM — Buy eSIM with Crypto | No KYC, 190+ Countries",
    description:
      "The only anonymous eSIM marketplace. Pay with Monero or Ethereum — no email, no identity, instant delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PRIVASIM — Anonymous eSIM Marketplace",
    description: "Buy eSIMs for 190+ countries with crypto. No email. No KYC.",
  },
  alternates: {
    canonical: APP_URL,
  },
  category: "technology",
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in Vercel env to verify the
  // domain in Google Search Console (required for Google sitemap submission
  // and indexing reports). Renders nothing until the env var is set.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "PRIVASIM",
      url: APP_URL,
      description:
        "Privacy-first eSIM marketplace accepting Monero and Ethereum. No KYC, no email, 190+ countries.",
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "PRIVASIM",
      description: "Buy eSIMs anonymously with Monero or Ethereum for 190+ countries.",
      publisher: { "@id": `${APP_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${APP_URL}/shop/{search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I buy an eSIM without email or ID?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. PRIVASIM requires zero identity verification. Pay from any crypto wallet — no email, no phone, no account, no KYC.",
          },
        },
        {
          "@type": "Question",
          name: "Which cryptocurrencies does PRIVASIM accept?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PRIVASIM accepts Monero (XMR) for maximum privacy, Ethereum (ETH), USDT on Ethereum mainnet, and 100+ other cryptocurrencies (BTC, LTC, SOL, DOGE and more) via anonymous swap. No credit cards.",
          },
        },
        {
          "@type": "Question",
          name: "How many countries does PRIVASIM cover?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PRIVASIM offers eSIM plans for 190+ countries across Asia Pacific, Europe, Americas, Middle East, and Africa.",
          },
        },
        {
          "@type": "Question",
          name: "How fast is eSIM delivery?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "eSIM activation codes are delivered instantly after blockchain confirmation — roughly 30 seconds for Ethereum, 2–10 minutes for Monero.",
          },
        },
        {
          "@type": "Question",
          name: "What devices support eSIM?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most iPhones from XS (2018) onwards, Samsung Galaxy S20+, Google Pixel 3+, and flagship Android phones from 2020+. Device must be carrier-unlocked.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="referrer" content="no-referrer" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-[#0a0a1a] antialiased`}>
        <PromoBanner />
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
        <Chatbot />
        <TrackVisit />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
