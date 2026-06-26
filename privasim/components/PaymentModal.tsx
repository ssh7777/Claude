"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Copy, CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
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

  // Poll for payment confirmation using the status endpoint
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
        // Ignore polling errors — server may not have this invoice in memory
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [open, status, invoiceId]);

  const copyToClipboard = async (text: string, field: "address" | "amount") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const cryptoSymbol = cryptoType === "monero" ? "XMR" : "ETH";
  const cryptoColor = cryptoType === "monero" ? "text-orange-400" : "text-blue-400";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#12122a] border-white/10 text-white max-w-md">
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
              Payment received! Your eSIM is being provisioned. Check your orders page in a moment.
            </p>
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
              This payment invoice has expired. Please create a new order.
            </p>
            <Button variant="outline" className="border-white/20 text-white w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-4">
            {/* Timer */}
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

            {/* QR Code */}
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
                : "Scan with MetaMask, Trust Wallet, or any ETH wallet — select Ethereum Mainnet & ETH token"}
            </p>

            {/* Amount */}
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

            {/* Address */}
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

            <Button
              variant="link"
              className="w-full text-gray-400 hover:text-white text-xs"
              asChild
            >
              <a href={paymentUrl}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in wallet app
              </a>
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Send the exact amount. Do not send from an exchange.
              {cryptoType === "monero" && " Monero confirmations take ~2–10 minutes (10 blocks)."}
              {cryptoType === "ethereum" && (
                <>
                  {" "}Send <strong className="text-blue-300">ETH on Ethereum Mainnet</strong> only.
                  Do not use USDT, BNB, MATIC, or other tokens/chains. Confirmations ~30 seconds.
                </>
              )}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
