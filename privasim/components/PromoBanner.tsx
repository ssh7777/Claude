"use client";

// Site-wide launch-offer banner. The code is a real, server-verified coupon
// (HMAC-signed, usage-capped in the ledger) — remove or swap the constant
// when the promotion ends; an expired code simply stops validating.

import { useState } from "react";
import { Copy, Check, Zap } from "lucide-react";

const PROMO_CODE = "TODAY20-20-20656-5FDB83E6FB32";
const PROMO_PERCENT = 20;

export default function PromoBanner() {
  const [copied, setCopied] = useState(false);

  if (!PROMO_CODE || PROMO_CODE.startsWith("__")) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-gradient-to-r from-[#ff6600] to-[#ff9944] text-white text-center px-3 py-2 text-sm font-medium">
      <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
        <Zap className="h-4 w-4 shrink-0" />
        Launch offer: {PROMO_PERCENT}% off every eSIM — code
        <button
          onClick={copy}
          title="Copy code"
          className="inline-flex items-center gap-1 bg-black/25 hover:bg-black/40 rounded px-2 py-0.5 font-mono text-xs tracking-tight transition-colors"
        >
          {PROMO_CODE}
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
        at checkout · limited redemptions
      </span>
    </div>
  );
}
