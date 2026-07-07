"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag, Wifi, Clock, CheckCircle, AlertCircle, Eye, Copy,
  ChevronDown, ChevronUp, RefreshCw, QrCode, Search, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd, formatDataAmount, formatDuration } from "@/lib/utils";
import Flag from "@/components/Flag";

const ORDERS_KEY = "privasim_orders";

interface SavedOrder {
  invoiceId: string;
  packageCode: string;
  packageName: string;
  country: string;
  countryCode: string;
  dataAmount: string;
  durationDays: number;
  amountUsd: number;
  amountCrypto: number;
  cryptoType: string;
  paymentAddress: string;
  expiresAt: string;
  createdAt: string;
  status: string;
  invoiceToken?: string;
}

interface EsimCodes {
  iccid: string;
  activationCode: string;
  smDpAddress: string;
}

interface EsimUsage {
  status: string;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    confirmed: { label: "Payment Confirmed", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    pending: { label: "Awaiting Payment", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    failed: { label: "Failed", color: "text-red-400 bg-red-400/10 border-red-400/20" },
    expired: { label: "Expired", color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
  };
  const s = map[status] ?? { label: status, color: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
}

function OrderRow({
  order,
  onStatusUpdate,
}: {
  order: SavedOrder;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [esimReady, setEsimReady] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [codes, setCodes] = useState<EsimCodes | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  // TX hash verification
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // eSIM data usage
  const [usage, setUsage] = useState<EsimUsage | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.invoiceId}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== order.status) {
          onStatusUpdate(order.invoiceId, data.status);
        }
        setEsimReady(data.esimReady ?? false);
      }
    } catch {
      // Server may not have this order after a cold start
    } finally {
      setChecking(false);
    }
  }, [order.invoiceId, order.status, onStatusUpdate]);

  // Load saved eSIM codes from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("privasim_codes") ?? "{}");
      if (saved[order.invoiceId]) {
        setCodes(saved[order.invoiceId]);
        setEsimReady(true);
      }
    } catch {}
  }, [order.invoiceId]);

  useEffect(() => {
    if (expanded && order.status === "pending") {
      checkStatus();
    }
  }, [expanded, order.status, checkStatus]);

  const revealCodes = async () => {
    // Check localStorage first (persisted from when codes were first received)
    try {
      const saved = JSON.parse(localStorage.getItem("privasim_codes") ?? "{}");
      if (saved[order.invoiceId]) {
        setCodes(saved[order.invoiceId]);
        setEsimReady(true);
        return;
      }
    } catch {}
    setRevealing(true);
    setError("eSIM codes not found in local storage. Please use the transaction hash below to re-verify your payment and retrieve your codes.");
    setRevealing(false);
  };

  const verifyPayment = async () => {
    if (!txHash.trim()) {
      setVerifyError("Please enter your transaction hash");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/orders/${order.invoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: txHash.trim(),
          invoiceToken: order.invoiceToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      const newCodes = {
        iccid: data.iccid,
        activationCode: data.activationCode,
        smDpAddress: data.smDpAddress ?? "",
      };
      onStatusUpdate(order.invoiceId, "confirmed");
      setCodes(newCodes);
      setEsimReady(true);
      // Persist codes to localStorage so they survive page refresh
      try {
        const saved = JSON.parse(localStorage.getItem("privasim_codes") ?? "{}");
        saved[order.invoiceId] = newCodes;
        localStorage.setItem("privasim_codes", JSON.stringify(saved));
      } catch {}
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const checkUsage = async () => {
    if (!codes?.iccid) return;
    setCheckingUsage(true);
    try {
      const res = await fetch(`/api/esim/status?iccid=${codes.iccid}`);
      if (res.ok) setUsage(await res.json());
    } catch {
      // ignore
    } finally {
      setCheckingUsage(false);
    }
  };

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired =
    order.status === "expired" ||
    (order.status === "pending" && new Date(order.expiresAt) < new Date());

  const currentStatus = isExpired && order.status !== "confirmed" ? "expired" : order.status;
  const cryptoSymbol = order.cryptoType === "monero" ? "XMR" : "ETH";
  const txPlaceholder = cryptoSymbol === "ETH" ? "0x..." : "Transaction ID (64 hex chars)";

  const TxVerifySection = () => (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        Paste your {cryptoSymbol === "ETH" ? "Ethereum" : "Monero"} transaction hash to verify on-chain
        and instantly receive your eSIM.
      </p>
      <input
        type="text"
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
        placeholder={txPlaceholder}
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
        {verifying ? "Verifying on blockchain…" : "Verify Payment & Get eSIM"}
      </Button>
    </div>
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Flag code={order.countryCode} className="text-base shrink-0" />
              <span className="font-semibold text-white text-sm truncate">{order.packageName}</span>
            </div>
            <StatusBadge status={currentStatus} />
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-400 hover:text-white p-1 shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Data</div>
            <div className="text-sm font-medium text-white">{formatDataAmount(order.dataAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Duration</div>
            <div className="text-sm font-medium text-white">{formatDuration(order.durationDays)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Paid</div>
            <div className="text-sm font-medium text-white">{formatUsd(order.amountUsd)}</div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          {new Date(order.createdAt).toLocaleDateString()} · {order.amountCrypto.toFixed(6)} {cryptoSymbol}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-3">

          {/* ── Pending (not expired) ─────────────────────────────────────── */}
          {order.status === "pending" && !isExpired && (
            <div className="space-y-2">
              <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3 text-sm text-yellow-300">
                Waiting for blockchain confirmation. Send exactly{" "}
                <strong>{order.amountCrypto.toFixed(8)} {cryptoSymbol}</strong> to complete your order.
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-gray-400 mb-1">Payment address</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-300 break-all flex-1">{order.paymentAddress}</code>
                  <Button
                    size="sm" variant="ghost"
                    className="text-gray-400 hover:text-white shrink-0 h-6 w-6 p-0"
                    onClick={() => copy(order.paymentAddress, "address")}
                  >
                    {copied === "address" ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <Button
                size="sm" variant="outline"
                className="w-full border-white/20 text-gray-300 hover:text-white"
                onClick={checkStatus}
                disabled={checking}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking…" : "Check payment status"}
              </Button>

              <div className="border-t border-white/10 pt-2">
                <p className="text-xs font-medium text-[#ff6600] mb-2">
                  Already sent? Verify your transaction hash to get your eSIM instantly:
                </p>
                <TxVerifySection />
              </div>
            </div>
          )}

          {/* ── Expired but payment may have been sent ────────────────────── */}
          {isExpired && order.status !== "confirmed" && (
            <div className="space-y-2">
              <div className="bg-gray-400/5 border border-gray-400/20 rounded-lg p-3 text-sm text-gray-300">
                Invoice expired. If you already sent payment, enter your transaction hash below to still receive your eSIM.
              </div>
              <TxVerifySection />
            </div>
          )}

          {/* ── Confirmed — show eSIM codes ───────────────────────────────── */}
          {(order.status === "confirmed" || esimReady) && (
            <div className="space-y-2">
              {!codes ? (
                <Button
                  onClick={revealCodes}
                  disabled={revealing}
                  className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white"
                  size="sm"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {revealing ? "Loading…" : "Reveal eSIM Codes"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-green-400 text-sm mb-1">
                    <QrCode className="h-4 w-4" />
                    Install this eSIM on your device
                  </div>

                  {[
                    { label: "ICCID", value: codes.iccid },
                    { label: "Activation Code", value: codes.activationCode },
                    { label: "SM-DP+ Address", value: codes.smDpAddress },
                  ]
                    .filter((f) => f.value)
                    .map((field) => (
                      <div key={field.label} className="bg-white/5 rounded-lg p-2">
                        <div className="text-xs text-gray-400 mb-1">{field.label}</div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-gray-200 break-all flex-1">{field.value}</code>
                          <Button
                            size="sm" variant="ghost"
                            className="text-gray-400 hover:text-white shrink-0 h-6 w-6 p-0"
                            onClick={() => copy(field.value, field.label)}
                          >
                            {copied === field.label
                              ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button size="sm" variant="outline" className="border-white/20 text-white text-xs" asChild>
                      <a href={`/esim/${encodeURIComponent(codes.iccid)}`}>Track this eSIM</a>
                    </Button>
                    <Button size="sm" className="bg-[#ff6600] hover:bg-[#e55c00] text-white text-xs" asChild>
                      <a href={`/topup?iccid=${encodeURIComponent(codes.iccid)}`}>Top up data</a>
                    </Button>
                  </div>

                  {/* Data usage */}
                  {usage ? (
                    <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-blue-300 text-xs font-medium mb-2">
                        <Activity className="h-3.5 w-3.5" />
                        Data Usage
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500">Status</div>
                          <div className="text-white capitalize">{usage.status}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Used</div>
                          <div className="text-white">{usage.dataUsedGb.toFixed(2)} GB</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Remaining</div>
                          <div className="text-green-400">{usage.dataRemainingGb.toFixed(2)} GB</div>
                        </div>
                        {usage.expiresAt && (
                          <div>
                            <div className="text-gray-500">Expires</div>
                            <div className="text-white">{new Date(usage.expiresAt).toLocaleDateString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm" variant="outline"
                      className="w-full border-white/20 text-gray-400 hover:text-white text-xs"
                      onClick={checkUsage}
                      disabled={checkingUsage}
                    >
                      <Activity className={`h-3.5 w-3.5 mr-1.5 ${checkingUsage ? "animate-spin" : ""}`} />
                      {checkingUsage ? "Checking…" : "Check Data Usage"}
                    </Button>
                  )}

                  <p className="text-xs text-gray-500">
                    Settings → Mobile Data → Add eSIM → Scan QR or enter manually.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg p-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-gray-600">
            Invoice: <code className="text-gray-500">{order.invoiceId.slice(0, 12)}…</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]") as SavedOrder[];
      setOrders(saved);
    } catch {
      setOrders([]);
    }
    setLoaded(true);
  }, []);

  const handleStatusUpdate = useCallback((invoiceId: string, newStatus: string) => {
    setOrders((prev) => {
      const updated = prev.map((o) =>
        o.invoiceId === invoiceId ? { ...o, status: newStatus } : o
      );
      try {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  if (!loaded) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-[#ff6600]" />
            <h1 className="text-2xl font-bold text-white">My Orders</h1>
          </div>
          {orders.length > 0 && (
            <span className="text-sm text-gray-400">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white/3 border border-white/8 rounded-xl">
            <Clock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">No orders yet</h2>
            <p className="text-gray-400 text-sm mb-2">
              Your eSIM orders appear here automatically after purchase.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              Orders are stored in your browser — no account needed.
            </p>
            <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
              <Link href="/shop">
                <Wifi className="h-4 w-4 mr-2" />
                Buy an eSIM
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderRow
                key={order.invoiceId}
                order={order}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
            <p className="text-xs text-gray-600 text-center mt-4">
              Orders are saved in this browser only. Clearing browser data removes this list.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
