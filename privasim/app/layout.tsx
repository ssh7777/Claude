import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "PRIVASIM — Privacy-First eSIM Marketplace",
    template: "%s | PRIVASIM",
  },
  description:
    "Buy eSIMs for 190+ countries with Monero or Ethereum. No email required. Zero tracking. Instant delivery.",
  keywords: ["esim", "privacy", "monero", "cryptocurrency", "travel sim", "anonymous esim"],
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    siteName: "PRIVASIM",
    title: "PRIVASIM — Privacy-First eSIM Marketplace",
    description: "Buy eSIMs with crypto. No email. No tracking.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* No analytics. No tracking pixels. No third-party scripts. */}
        <meta name="referrer" content="no-referrer" />
      </head>
      <body className={`${inter.className} min-h-screen bg-[#0a0a1a]`}>
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
