import { Metadata } from "next";
import { Shield, Lock, Eye, Database, Trash2, Coins, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What PRIVASIM processes to create, verify, and deliver eSIM orders.",
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
          Last updated: October 7, 2026. This policy describes the information needed to process and deliver an eSIM order.
        </p>
      </div>

      <div className="space-y-8">
        <Section icon={Eye} title="Information we do not ask for" id="no-tracking">
          <p className="text-sm text-gray-300">
            Checkout does not require an account, email address, telephone number, real name, or payment-card details. We do not use advertising pixels, browser fingerprinting, third-party analytics scripts, or analytics cookies. An optional wallet connection uses a one-time signed challenge; merely purchasing an eSIM does not require connecting a wallet.
          </p>
        </Section>

        <Section icon={Database} title="Information processed for an order" id="order-data">
          <ul className="space-y-2 text-sm text-gray-300">
            <li>Random invoice ID, selected plan, quoted price, payment address, expiry, payment status and confirmation count.</li>
            <li>A keyed HMAC of the blockchain transaction hash is retained to prevent a payment from being claimed twice; the raw transaction hash is checked with the relevant chain/wallet service and is not stored in the invoice record.</li>
            <li>When you optionally connect an Ethereum wallet, a keyed HMAC of its address is used to associate your session with orders. We do not store the address in the order database.</li>
            <li>eSIM ICCID and activation credentials are encrypted at rest using AES-256-GCM. PRIVASIM&apos;s server must be able to decrypt them to deliver them to the order holder; they are not decryptable only by the customer and are not protected by the customer&apos;s wallet signature.</li>
            <li>For a top-up, the ICCID you submit is encrypted at rest and sent to the eSIM supplier to apply the top-up.</li>
          </ul>
        </Section>

        <Section icon={Lock} title="Browser storage and order access">
          <p className="text-sm text-gray-300">
            Your browser stores the random invoice token, basic order details, and—after delivery—the eSIM credentials so you can return to the order page. Anyone with that token can access the corresponding order, so do not share it and clear site data on shared devices. No authentication cookie is required.
          </p>
        </Section>

        <Section icon={ExternalLink} title="Service providers and blockchain networks">
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              We send the plan and necessary provisioning identifiers to PikaSim, our eSIM supplier. Ethereum payment verification uses a configured Ethereum RPC provider (or public fallback RPC services); Monero invoices use a dedicated receiving subaddress and are checked against the configured Monero wallet RPC. Those providers process the requests needed to provide their services under their own terms and retention practices.
            </p>
            <p>
              If you choose the optional “other coins” payment route, checkout links to Trocador for a crypto swap. Trocador is a separate service and may receive connection and transaction information; review its privacy terms before using it. Public blockchain data, including Ethereum transactions, may be visible to anyone independently of PRIVASIM.
            </p>
            <p>
              Our hosting, database, and network providers also process technical data to operate and secure the service. Their infrastructure may receive connection metadata, including IP addresses. PRIVASIM does not write raw visitor IP addresses to its application database or application logs; abuse-control counters are keyed by a server-secret HMAC and expire automatically.
            </p>
          </div>
        </Section>

        <Section icon={Trash2} title="Retention and deletion" id="retention">
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              The application is configured to delete invoice and payment-claim records 30 days after order creation. Temporary authentication challenges and rate-limit buckets are cleaned up automatically. The scheduled deletion requires a configured PostgreSQL database and deployment cron secret; deployment operators must verify that the scheduled job is active.
            </p>
            <p>
              Copies in your browser remain until you clear local site storage. Blockchain records, hosting logs, and supplier records are outside PRIVASIM&apos;s deletion controls and may be retained under their operators&apos; policies.
            </p>
          </div>
        </Section>

        <Section icon={Coins} title="Cryptocurrency payments" id="payments">
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              Monero invoices use a fresh subaddress generated by our receiving wallet. Ethereum and USDT payments are pseudonymous rather than anonymous and can be publicly traceable. Payment verification checks the destination, amount, successful execution, and required confirmations before fulfillment.
            </p>
            <p>Never send a different token or use a different chain than the invoice specifies.</p>
          </div>
        </Section>

        <Section icon={Shield} title="Your choices and our commitments">
          <ul className="space-y-2 text-sm text-gray-300">
            <li>Use checkout without connecting a wallet; wallet connection is optional.</li>
            <li>Clear local browser storage at any time (this also removes locally saved order details and credentials).</li>
            <li>We do not sell order data or use it for advertising, and we do not require contact details to purchase.</li>
            <li>We limit retained order data to delivery, payment-integrity, fraud-prevention, and operational needs.</li>
          </ul>
        </Section>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-gray-400">
          <p>
            This page describes the application design and does not override the independent privacy policies of hosting, database, RPC, supplier, or swap providers. Operators should obtain jurisdiction-specific legal review before production use.
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
    <section id={id} className="bg-white/3 border border-white/8 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-[#ff6600]" />
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}
