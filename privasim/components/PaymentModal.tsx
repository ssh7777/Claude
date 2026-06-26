"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle, Clock, AlertCircle, ExternalLink, Search, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUsd, timeUntil } from "@/lib/utils";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  packageName: string;
  packageCode: string;
  amountUsd: number;
  amountCrypto: number;
  cryptoType: "monero" | "ethereum";
  paymentAddress: string;
  qrCode: string;
  paymentUrl: string;
  expiresAt: string;
}

export default function PaymentModal({
  open,
  onClose,
  invoiceId,
  packageName,
  packageCode,
  amountUsd,
  amountCrypto,
  cryptoType,
  paymentAddress,
  qrCode,
  paymentUrl,
  expiresAt,
}: PaymentModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeUntil(expiresAt));
  const [status, setStatus] = useState<"pending" | "confirmed" | "expired">("pending");

  // TX hash verification
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifiedCodes, setVerifiedCodes] = useState<{
    iccid: string;
    activationCode: string;
    smDpAddress: string;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = timeUntil(expiresAt);
      setTimeLeft(remaining);
      if (remaining === "Expired") {
        setStatus("expired");
        clearInterval(interval);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Poll for automatic payment confirmation
  useEffect(() => {
    if (!open || status !== "pending") return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${invoiceId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "confirmed") {
            setStatus("confirmed");
            clearInterval(poll);
          }
        }
      } catch {
        // Ignore — server may not have this invoice in memory after cold start
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [open, status, invoiceId]);

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const verifyPayment = async () => {
    if (!txHash.trim()) {
      setVerifyError("Please enter your transaction hash");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/orders/${invoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: txHash.trim(),
          packageCode,
          cryptoType,
          amountCrypto,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      const codes = { iccid: data.iccid, activationCode: data.activationCode, smDpAddress: data.smDpAddress ?? "" };
      setVerifiedCodes(codes);
      setStatus("confirmed");
      // Persist codes to localStorage so they survive page refresh
      try {
        const saved = JSON.parse(localStorage.getItem("privasim_codes") ?? "{}");
        saved[invoiceId] = codes;
        localStorage.setItem("privasim_codes", JSON.stringify(saved));
      } catch {}
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const isEth = cryptoType === "ethereum";
  const cryptoSymbol = isEth ? "ETH" : "XMR";
  const cryptoColor = isEth ? "text-blue-400" : "text-orange-400";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#12122a] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {status === "confirmed" ? "Payment Confirmed!" : "Complete Your Payment"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">{packageName}</DialogDescription>
        </DialogHeader>

        {/* ── Confirmed ─────────────────────────────────────────────────── */}
        {status === "confirmed" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-16 w-16 text-green-400" />
            <p className="text-center text-gray-300">
              Payment verified! Your eSIM is ready.
            </p>

            {verifiedCodes && (
              <div className="w-full space-y-2">
                {[
                  { label: "ICCID", value: verifiedCodes.iccid, id: "iccid" },
                  { label: "Activation Code", value: verifiedCodes.activationCode, id: "code" },
                  { label: "SM-DP+ Address", value: verifiedCodes.smDpAddress, id: "smdp" },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label} className="bg-white/5 rounded-lg p-2">
                      <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs text-gray-200 break-all flex-1">{f.value}</code>
                        <Button
                          size="sm" variant="ghost"
                          className="text-gray-400 hover:text-white shrink-0 h-6 w-6 p-0"
                          onClick={() => copy(f.value, f.id)}
                        >
                          {copied === f.id
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                <p className="text-xs text-gray-500 text-center mt-1">
                  Codes saved — find them again at /orders
                </p>
              </div>
            )}

            {!verifiedCodes && (
              <p className="text-xs text-center text-gray-400">
                Check your orders page to retrieve your eSIM codes.
              </p>
            )}

            <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white w-full" onClick={onClose}>
              View Orders
            </Button>
          </div>
        )}

        {/* ── Expired ───────────────────────────────────────────────────── */}
        {status === "expired" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-16 w-16 text-red-400" />
            <p className="text-center text-gray-300">
              Invoice expired. If you already sent payment, go to Orders and paste your transaction hash.
            </p>
            <Button variant="outline" className="border-white/20 text-white w-full" onClick={onClose}>
              Go to Orders
            </Button>
          </div>
        )}

        {/* ── Pending ───────────────────────────────────────────────────── */}
        {status === "pending" && (
          <div className="space-y-3">
            {/* Timer + network badge */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-yellow-400">
                <Clock className="h-4 w-4" />
                {timeLeft}
              </div>
              <Badge variant={isEth ? "ethereum" : "monero"}>
                {isEth ? "Ethereum (ETH)" : "Monero (XMR)"}
              </Badge>
            </div>

            {/* Network warning for ETH */}
            {isEth && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <strong>Ethereum Mainnet only (Chain ID: 1)</strong><br />
                  Do NOT use Polygon, Arbitrum, BSC, or other L2 chains — your payment will be lost.
                  Only send native ETH, not USDT, USDC, or wrapped tokens.
                </div>
              </div>
            )}

            {/* STEP 1: Send payment */}
            <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-[#ff6600] text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
                <span className="text-sm font-semibold text-white">Send payment</span>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <a href={paymentUrl} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt="Payment QR Code"
                    className="w-40 h-40 rounded-lg border border-white/10"
                  />
                </a>
              </div>

              {/* Amount */}
              <div className="bg-white/5 rounded-lg p-2.5">
                <div className="text-xs text-gray-400 mb-1">Exact amount to send</div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-base font-bold ${cryptoColor}`}>
                      {amountCrypto.toFixed(8)} {cryptoSymbol}
                    </span>
                    <span className="text-sm text-gray-400 ml-2">≈ {formatUsd(amountUsd)}</span>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="text-gray-400 hover:text-white h-7 w-7 p-0"
                    onClick={() => copy(amountCrypto.toFixed(8), "amount")}
                  >
                    {copied === "amount" ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Address */}
              <div className="bg-white/5 rounded-lg p-2.5">
                <div className="text-xs text-gray-400 mb-1">Payment address</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-gray-300 break-all flex-1">{paymentAddress}</code>
                  <Button
                    size="sm" variant="ghost"
                    className="text-gray-400 hover:text-white shrink-0 h-7 w-7 p-0"
                    onClick={() => copy(paymentAddress, "address")}
                  >
                    {copied === "address" ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <Button variant="link" className="w-full text-gray-400 hover:text-white text-xs" asChild>
                <a href={paymentUrl}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open in wallet app
                </a>
              </Button>
            </div>

            {/* STEP 2: Get eSIM with TX hash */}
            <div className="bg-white/3 border border-[#ff6600]/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-[#ff6600] text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
                <span className="text-sm font-semibold text-white">Get your eSIM instantly</span>
              </div>

              <p className="text-xs text-gray-400">
                After sending, paste your <strong className="text-gray-200">Transaction ID (TX hash)</strong> here.
                {isEth
                  ? " Find it in MetaMask → Activity tab → tap the transaction → \"View on Etherscan\" → copy the hash starting with 0x."
                  : " Find it in your Monero wallet under Transactions — it is a 64-character hex string."}
              </p>

              <input
                type="text"
                value={txHash}
                onChange={(e) => { setTxHash(e.target.value); setVerifyError(""); }}
                placeholder={isEth ? "0x... (66 characters)" : "Transaction ID (64 hex characters)"}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6600]/50 font-mono"
              />

              {verifyError && (
                <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg p-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              <Button
                size="sm"
                className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white"
                onClick={verifyPayment}
                disabled={verifying || !txHash.trim()}
              >
                <Search className={`h-3.5 w-3.5 mr-1.5 ${verifying ? "animate-spin" : ""}`} />
                {verifying ? "Verifying on blockchain…" : "Verify Payment & Get eSIM"}
              </Button>
            </div>

            <p className="text-xs text-gray-600 text-center">
              {isEth
                ? "ETH confirms in ~30 sec. Do not send from an exchange — use a self-custody wallet."
                : "XMR takes 2–10 min (10 block confirmations). Do not send from an exchange."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
