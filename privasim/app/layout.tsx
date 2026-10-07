import type { Metadata, Viewport } from "next";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";

const APP_URL = "https://privasim.app";

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
    default: "PRIVASIM — Buy eSIM with Crypto | 190+ Countries, No Account Required",
    template: "%s | PRIVASIM",
  },
  description:
    "Buy prepaid eSIMs for 190+ countries with cryptocurrency, without an identity account. Minimal order records support payment verification and secure delivery.",
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
    title: "PRIVASIM — Buy eSIM with Crypto | No Account, 190+ Countries",
    description:
      "Prepaid eSIMs for 190+ countries. No identity account is required; payment verification and delivery use a temporary order record.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PRIVASIM — eSIMs with Cryptocurrency",
    description: "Buy prepaid eSIMs for 190+ countries without an identity account. Order records support payment verification and delivery.",
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
        "Privacy-focused eSIM marketplace accepting cryptocurrency without requiring an identity account. Order data is retained temporarily for payment verification and delivery.",
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "PRIVASIM",
      description: "Buy prepaid eSIMs for 190+ countries with cryptocurrency and no identity account requirement.",
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
            text: "Checkout does not require an identity account, email, phone number, or ID, and connecting a wallet is optional. Supplier and local SIM-registration requirements may vary by destination."
          },
        },
        {
          "@type": "Question",
          name: "Which cryptocurrencies does PRIVASIM accept?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PRIVASIM accepts Monero (XMR), Ethereum (ETH), USDT on Ethereum mainnet, and additional coins through a separate Trocador swap flow. Swap-provider terms and network fees apply. No credit cards.",
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
            text: "Delivery starts after required confirmations and supplier fulfillment. Ethereum requires 12 confirmations and Monero requires 10; actual times vary with network conditions and supplier response.",
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
      <body className="font-sans min-h-screen bg-[#0a0a1a] antialiased">
        <PromoBanner />
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
        <Chatbot />
      </body>
    </html>
  );
}
