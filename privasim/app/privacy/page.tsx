import { Metadata } from "next";
import { Shield, Lock, Eye, Database, Trash2, Coins } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "PRIVASIM collects no personal data. Our privacy policy explains how we protect you.",
};

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-3xl">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-8 w-8 text-[#ff6600]" />
          <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
        </div>
        <p className="text-gray-400">
          Last updated: June 2026. PRIVASIM is built with privacy as the primary design
          principle, not an afterthought.
        </p>
      </div>

      <div className="space-y-8">
        <Section icon={Eye} title="What We Do NOT Collect" id="no-tracking">
          <ul className="space-y-2 text-gray-300">
            {[
              "Email addresses",
              "Phone numbers",
              "Real names",
              "Physical addresses",
              "IP addresses (not logged)",
              "Browser fingerprints",
              "Cookies of any kind",
              "Analytics or tracking pixels",
              "Third-party scripts",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Database} title="What We Store" id="encryption">
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              We store only what is strictly necessary to provide the service:
            </p>
            <ul className="space-y-2">
              {[
                "Hashed wallet addresses (SHA-256, irreversible — we cannot reverse this to identify you)",
                "Encrypted eSIM activation codes (AES-256-GCM — only you can decrypt with your wallet signature)",
                "Encrypted ICCID numbers (same encryption)",
                "Order status and expiry dates (no personal identifiers)",
                "Hashed Monero/Ethereum transaction IDs (for payment verification only)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-[#ff6600] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section icon={Trash2} title="Auto-Deletion">
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              All order records are automatically deleted 30 days after creation, regardless
              of status. This is not configurable — it happens automatically at the database level.
            </p>
            <p>
              Payment invoices are deleted upon expiry (15 minutes if unpaid, or immediately
              after confirmation).
            </p>
            <p className="text-yellow-400">
              Important: Save your eSIM activation codes before the 30-day auto-delete window.
              We cannot recover deleted data.
            </p>
          </div>
        </Section>

        <Section icon={Coins} title="Monero Payments" id="monero">
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              Monero (XMR) is our recommended payment method. Monero provides:
            </p>
            <ul className="space-y-1.5">
              {[
                "Stealth addresses — each transaction uses a one-time address",
                "Ring signatures — sender cannot be identified",
                "Confidential transactions — amounts are hidden",
                "No blockchain analysis possible",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
            <p>
              Ethereum payments are pseudonymous (not anonymous) — use a fresh wallet or
              a privacy mixer if you want maximum privacy.
            </p>
          </div>
        </Section>

        <Section icon={Shield} title="Our Commitments">
          <div className="text-sm text-gray-300 space-y-2">
            <ul className="space-y-2">
              {[
                "We will never sell data (there is no personal data to sell)",
                "We will never comply with data requests for user identity (we don't have it)",
                "We will never add analytics, tracking, or advertising",
                "We will never require email or phone number",
                "We will never store payment card data",
                "All source code is designed to minimize data retention",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-[#ff6600] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-gray-400">
          <p>
            PRIVASIM is not a financial institution, does not provide financial services,
            and does not process payments through traditional payment rails. All transactions
            are peer-to-peer cryptocurrency payments sent directly to our wallet addresses.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  id,
  children,
}: {
  icon: React.ElementType;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white/3 border border-white/8 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-[#ff6600]" />
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
