"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle, Clock, AlertCircle, ExternalLink, Search } from "lucide-react";
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
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeUntil(expiresAt));
  const [status, setStatus] = useState<"pending" | "confirmed" | "expired">("pending");

  const [showVerify, setShowVerify] = useState(false);
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
        // ignore
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [open, status, invoiceId]);

  const copyToClipboard = async (text: string, field: "address" | "amount") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyCode = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field as "address" | "amount");
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
      setVerifiedCodes({ iccid: data.iccid, activationCode: data.activationCode, smDpAddress: data.smDpAddress ?? "" });
      setStatus("confirmed");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const cryptoSymbol = cryptoType === "monero" ? "XMR" : "ETH";
  const cryptoColor = cryptoType === "monero" ? "text-orange-400" : "text-blue-400";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#12122a] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {status === "confirmed" ? "Payment Confirmed!" : "Complete Your Payment"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">{packageName}</DialogDescription>
        </DialogHeader>

        {status === "confirmed" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-16 w-16 text-green-400" />
            <p className="text-center text-gray-300">
              Payment verified! Your eSIM is ready.
            </p>

            {verifiedCodes && (
              <div className="w-full space-y-2">
                {[
                  { label: "ICCID", value: verifiedCodes.iccid, field: "iccid" },
                  { label: "Activation Code", value: verifiedCodes.activationCode, field: "code" },
                  { label: "SM-DP+ Address", value: verifiedCodes.smDpAddress, field: "smdp" },
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
                          onClick={() => copyCode(f.value, f.field)}
                        >
                          {copied === f.field
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                <p className="text-xs text-gray-500 text-center mt-1">
                  Save these codes — also available at /orders
                </p>
              </div>
            )}

            {!verifiedCodes && (
              <p className="text-xs text-center text-gray-400">
                Check your orders page in a moment to retrieve your eSIM codes.
              </p>
            )}

            <Button
              className="bg-[#ff6600] hover:bg-[#e55c00] text-white w-full"
              onClick={onClose}
            >
              View Orders
            </Button>
          </div>
        )}

        {status === "expired" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-16 w-16 text-red-400" />
            <p className="text-center text-gray-300">
              This payment invoice has expired. If you already sent payment, go to Orders and enter your TX hash.
            </p>
            <Button variant="outline" className="border-white/20 text-white w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-yellow-400">
                <Clock className="h-4 w-4" />
                {timeLeft}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={cryptoType === "monero" ? "monero" : "ethereum"}>
                  {cryptoType === "monero" ? "Monero (XMR)" : "Ethereum (ETH)"}
                </Badge>
                {cryptoType === "ethereum" && (
                  <span className="text-xs text-blue-300 font-medium">Mainnet only — NOT USDT</span>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <a href={paymentUrl} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Payment QR Code"
                  className="w-48 h-48 rounded-lg border border-white/10"
                />
              </a>
            </div>
            <p className="text-xs text-center text-gray-400">
              {cryptoType === "monero"
                ? "Scan with your Monero wallet (Cake Wallet, Feather, etc.)"
                : "Scan with MetaMask, Trust Wallet, or any ETH wallet — Ethereum Mainnet & ETH token"}
            </p>

            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Amount to send</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-lg font-bold ${cryptoColor}`}>
                    {amountCrypto.toFixed(8)} {cryptoSymbol}
                  </span>
                  <span className="text-sm text-gray-400 ml-2">≈ {formatUsd(amountUsd)}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                  onClick={() => copyToClipboard(amountCrypto.toFixed(8), "amount")}
                >
                  {copied === "amount" ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Payment address</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-gray-300 break-all flex-1">{paymentAddress}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white shrink-0"
                  onClick={() => copyToClipboard(paymentAddress, "address")}
                >
                  {copied === "address" ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button variant="link" className="w-full text-gray-400 hover:text-white text-xs" asChild>
              <a href={paymentUrl}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in wallet app
              </a>
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Send the exact amount. Do not send from an exchange.
              {cryptoType === "monero" && " Monero confirmations take ~2–10 minutes (10 blocks)."}
              {cryptoType === "ethereum" && (
                <> Send <strong className="text-blue-300">ETH on Ethereum Mainnet</strong> only.
                  Not USDT, BNB, MATIC, or other tokens. Confirmations ~30 seconds.</>
              )}
            </p>

            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() => { setShowVerify((v) => !v); setVerifyError(""); }}
                className="text-xs text-[#ff6600] hover:text-orange-300 transition-colors w-full text-center"
              >
                {showVerify ? "▲ Hide" : "▼ Already sent? Verify transaction hash for instant delivery"}
              </button>
              {showVerify && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder={cryptoType === "ethereum" ? "0x..." : "Transaction ID (64 hex chars)"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6600]/50 font-mono"
                  />
                  {verifyError && (
                    <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg p-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {verifyError}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white"
                    onClick={verifyPayment}
                    disabled={verifying || !txHash.trim()}
                  >
                    <Search className={`h-3.5 w-3.5 mr-1.5 ${verifying ? "animate-spin" : ""}`} />
                    {verifying ? "Verifying on blockchain…" : "Verify Payment & Get eSIM Now"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
