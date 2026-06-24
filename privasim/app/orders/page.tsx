"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Shield,
  Wifi,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatDataAmount, formatDuration, timeUntil } from "@/lib/utils";
import type { Order } from "@/types";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
    completed: { label: "Active", variant: "success" },
    activated: { label: "Activated", variant: "success" },
    pending: { label: "Pending Payment", variant: "warning" },
    expired: { label: "Expired", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "secondary" },
  };
  const s = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decrypted, setDecrypted] = useState<{ iccid: string; activationCode: string; smDpAddress: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDecrypt = async () => {
    if (decrypted) return;
    const jwt = localStorage.getItem("privasim_jwt");
    if (!jwt) {
      setError("Please connect your wallet to view eSIM details.");
      return;
    }

    setDecrypting(true);
    setError("");

    try {
      // For Ethereum wallets, sign the decrypt request
      const walletData = localStorage.getItem("privasim_wallet");
      const wallet = walletData ? JSON.parse(walletData) : null;
      let signature = "monero-wallet-auth"; // Monero: trust JWT

      if (wallet?.type === "ethereum" && window.ethereum) {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        signature = await signer.signMessage(`PRIVASIM:decrypt:${order.id}`);
      }

      const res = await fetch(`/api/orders/${order.id}/decrypt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ walletSignature: signature }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Decryption failed");
      setDecrypted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decrypt");
    } finally {
      setDecrypting(false);
    }
  };

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-[#ff6600]" />
            <span className="font-semibold text-white text-sm">{order.packageName}</span>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Data</div>
            <div className="text-sm font-medium text-white">{formatDataAmount(order.dataAmount)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Duration</div>
            <div className="text-sm font-medium text-white">{formatDuration(order.durationDays)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Expires</div>
            <div className="text-sm font-medium text-white">{timeUntil(order.expiresAt)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Paid: <span className="text-white">{formatUsd(order.costUsd)}</span>
            {" "}via{" "}
            <span className={order.cryptoType === "monero" ? "text-orange-400" : "text-blue-400"}>
              {order.cryptoType}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-3">
          {!decrypted ? (
            <Button
              onClick={handleDecrypt}
              disabled={decrypting || order.status === "pending"}
              className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white"
              size="sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              {decrypting ? "Decrypting..." : "Reveal eSIM Codes"}
            </Button>
          ) : (
            <div className="space-y-2">
              {[
                { label: "ICCID", value: decrypted.iccid },
                { label: "Activation Code", value: decrypted.activationCode },
                { label: "SM-DP+ Address", value: decrypted.smDpAddress },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <div key={field.label} className="bg-white/5 rounded-lg p-2">
                    <div className="text-xs text-gray-400 mb-1">{field.label}</div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-gray-200 break-all flex-1">{field.value}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-white shrink-0 h-6 w-6 p-0"
                        onClick={() => copy(field.value, field.label)}
                      >
                        {copied === field.label ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Order ID: {order.id.slice(0, 8)}... &bull; Created:{" "}
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const jwt = localStorage.getItem("privasim_jwt");
    if (!jwt) {
      setLoading(false);
      return;
    }
    setHasWallet(true);

    fetch("/api/orders", {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then((r) => r.json())
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="container py-12">
        <div className="max-w-md mx-auto text-center">
          <Shield className="h-12 w-12 text-[#ff6600] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">
            Connect your Monero or Ethereum wallet to view your orders. No email or account required.
          </p>
          <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
            <Link href="/shop">Browse eSIMs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="h-6 w-6 text-[#ff6600]" />
          <h1 className="text-2xl font-bold text-white">My Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white/3 border border-white/8 rounded-xl">
            <Clock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">No orders yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Your eSIM orders will appear here after purchase.
            </p>
            <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
              <Link href="/shop">Buy an eSIM</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
