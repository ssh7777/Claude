"use client";

// Top Up Your eSIM — enter ICCID, pick a refill, pay with crypto.
// Fully first-party flow: options come from our backend, payment uses the
// same invoice + on-chain verification pipeline as regular purchases.

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  BatteryCharging,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { retailPrice } from "@/lib/prices";

interface TopupOption {
  packageCode: string;
  name?: string;
  priceUsd?: number;
}

interface Invoice {
  invoiceId: string;
  amountCrypto: number;
  cryptoType: string;
  paymentAddress: string;
  amountUsd: number;
  invoiceToken?: string;
}

function TopupInner() {
  const searchParams = useSearchParams();
  const [iccid, setIccid] = useState(searchParams.get("iccid") ?? "");
  const [options, setOptions] = useState<TopupOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<TopupOption | null>(null);
  const [crypto, setCrypto] = useState<"monero" | "ethereum">("ethereum");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState("");
  const [copied, setCopied] = useState(false);

  const loadOptions = useCallback(async (id: string) => {
    if (!/^89\d{17,18}$/.test(id.trim())) {
      setError("Enter a valid ICCID — it's the 19–20 digit number starting with 89 from your order.");
      return;
    }
    setLoading(true);
    setError("");
    setOptions(null);
    try {
      const res = await fetch(`/api/esim/topup?iccid=${encodeURIComponent(id.trim())}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load top-up options");
      const opts = (j.options ?? []).filter((o: TopupOption) => o.priceUsd);
      if (opts.length === 0) throw new Error("No top-up packages available for this eSIM.");
      setOptions(opts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const pre = searchParams.get("iccid");
    if (pre) loadOptions(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createInvoice = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const { getSolvedCaptcha } = await import("@/lib/pow");
      const captcha = await getSolvedCaptcha();

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageCode: selected.packageCode,
          cryptoType: crypto,
          topupIccid: iccid.trim(),
          captcha,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not create invoice");
      setInvoice(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!invoice || !txHash.trim()) return;
    setVerifying(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${invoice.invoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: txHash.trim(),
          invoiceToken: invoice.invoiceToken,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Verification failed");
      setDone(j.message ?? "Top-up applied!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const copy = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice.paymentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="container py-12 max-w-xl">
      <div className="text-center mb-10">
        <div className="h-14 w-14 rounded-xl bg-[#ff6600] flex items-center justify-center mx-auto mb-4">
          <BatteryCharging className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">
          Top Up Your <span className="gradient-text">eSIM</span>
        </h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Add more data to an eSIM you already own — no new installation, same eSIM keeps
          working. Phone plans keep their number.
        </p>
      </div>

      {done ? (
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
          <Check className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Top-up successful!</h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{done}</p>
          <Button className="mt-4 bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
            <a href={`/esim/${encodeURIComponent(iccid.trim())}`}>Check my eSIM status</a>
          </Button>
        </div>
      ) : invoice ? (
        <div className="space-y-4">
          <div className="p-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
            <p className="text-yellow-200 text-sm">
              Send exactly{" "}
              <strong className="text-white">
                {invoice.amountCrypto.toFixed(6)} {invoice.cryptoType === "monero" ? "XMR" : "ETH"}
              </strong>{" "}
              (${invoice.amountUsd.toFixed(2)}) to:
            </p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-xs text-gray-400 mb-1">Payment address</div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-white break-all flex-1">{invoice.paymentAddress}</code>
              <button onClick={copy} className="p-2 rounded hover:bg-white/10 shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
              </button>
            </div>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-sm text-[#ff9944] font-medium mb-2">
              Already sent? Paste your transaction hash:
            </div>
            <Input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x…"
              className="bg-white/10 border-white/20 text-white mb-3"
            />
            <Button
              onClick={verify}
              disabled={verifying || !txHash.trim()}
              className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white"
            >
              {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Verify Payment & Apply Top-Up
            </Button>
          </div>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2">
            <Input
              value={iccid}
              onChange={(e) => setIccid(e.target.value)}
              placeholder="Your ICCID (starts with 89…)"
              className="bg-white/10 border-white/20 text-white h-12"
            />
            <Button
              onClick={() => loadOptions(iccid)}
              disabled={loading}
              className="bg-[#ff6600] hover:bg-[#e55c00] text-white h-12 px-6"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find plans"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Your ICCID is on your order page under <a href="/orders" className="text-[#ff6600]">/orders</a>.
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300 flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {options && (
            <>
              <div className="space-y-2">
                {options.map((opt) => (
                  <button
                    key={opt.packageCode}
                    onClick={() => setSelected(opt)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      selected?.packageCode === opt.packageCode
                        ? "bg-[#ff6600]/15 border-[#ff6600]"
                        : "bg-white/5 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span className="text-white font-medium">{opt.name ?? opt.packageCode}</span>
                    <span className="text-[#ff9944] font-bold">
                      ${retailPrice(opt.priceUsd ?? 0).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["ethereum", "monero"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCrypto(c)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                          crypto === c
                            ? "bg-[#ff6600]/15 border-[#ff6600] text-white"
                            : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                        }`}
                      >
                        <Coins className="h-4 w-4" />
                        {c === "ethereum" ? "Ethereum (fast)" : "Monero (private)"}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={createInvoice}
                    disabled={loading}
                    className="w-full h-12 bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Pay ${retailPrice(selected.priceUsd ?? 0).toFixed(2)} — get payment address
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopupPage() {
  return (
    <Suspense fallback={<div className="container py-24 text-center"><Loader2 className="h-8 w-8 text-[#ff6600] animate-spin mx-auto" /></div>}>
      <TopupInner />
    </Suspense>
  );
}
