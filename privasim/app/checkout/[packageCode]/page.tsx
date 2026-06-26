"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Wifi,
  Clock,
  Check,
  Coins,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentModal from "@/components/PaymentModal";
import { formatUsd, formatDataAmount, formatDuration } from "@/lib/utils";
import type { EsimPackage, CryptoType } from "@/types";

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
}

function saveOrderToLocal(order: SavedOrder) {
  try {
    const existing: SavedOrder[] = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
    const updated = [order, ...existing.filter((o) => o.invoiceId !== order.invoiceId)];
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch {}
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const packageCode = params.packageCode as string;

  const [pkg, setPkg] = useState<EsimPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [cryptoType, setCryptoType] = useState<CryptoType>("monero");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{
    invoiceId: string;
    amountUsd: number;
    amountCrypto: number;
    paymentAddress: string;
    qrCode: string;
    paymentUrl: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/packages/${packageCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push("/shop");
        } else {
          setPkg(data);
        }
      })
      .catch(() => router.push("/shop"))
      .finally(() => setLoading(false));
  }, [packageCode, router]);

  const handleCreateOrder = async () => {
    setCreating(true);
    setError("");

    const jwt = localStorage.getItem("privasim_jwt");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers,
        body: JSON.stringify({ packageCode, cryptoType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? `Order failed (HTTP ${res.status})`);

      // Save order to localStorage so it appears in orders page without wallet
      saveOrderToLocal({
        invoiceId: data.invoiceId,
        packageCode: data.packageCode,
        packageName: data.packageName,
        country: data.country ?? pkg?.country ?? "",
        countryCode: data.countryCode ?? pkg?.countryCode ?? "",
        dataAmount: data.dataAmount ?? pkg?.dataAmount ?? "",
        durationDays: data.durationDays ?? pkg?.durationDays ?? 0,
        amountUsd: data.amountUsd,
        amountCrypto: data.amountCrypto,
        cryptoType: data.cryptoType ?? cryptoType,
        paymentAddress: data.paymentAddress,
        expiresAt: data.expiresAt,
        createdAt: new Date().toISOString(),
        status: "pending",
      });

      setInvoice({
        invoiceId: data.invoiceId,
        amountUsd: data.amountUsd,
        amountCrypto: data.amountCrypto,
        paymentAddress: data.paymentAddress,
        qrCode: data.qrCode,
        paymentUrl: data.paymentUrl,
        expiresAt: data.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-12">
        <div className="max-w-lg mx-auto animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/3 mb-8" />
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!pkg) return null;

  const displayPrice = pkg.priceUsd * 1.5;

  return (
    <div className="container py-12">
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white mb-6" asChild>
          <Link href={`/shop/${pkg.countryCode}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {pkg.country}
          </Link>
        </Button>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">{pkg.name}</h1>
            <Badge variant={pkg.type === "phone" ? "ethereum" : "monero"}>
              {pkg.type === "data" ? <Wifi className="h-3 w-3 mr-1" /> : null}
              {pkg.type}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <Wifi className="h-3 w-3" />
                Data
              </div>
              <div className="font-semibold text-white">{formatDataAmount(pkg.dataAmount)}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3" />
                Duration
              </div>
              <div className="font-semibold text-white">{formatDuration(pkg.durationDays)}</div>
            </div>
          </div>

          <ul className="space-y-2 mb-4">
            {[
              "Instant eSIM delivery",
              "No personal data required",
              "Encrypted eSIM credentials",
              "Works on unlocked devices",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="h-4 w-4 text-green-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total</span>
              <span className="text-2xl font-bold text-white">{formatUsd(displayPrice)}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4 text-[#ff6600]" />
            Payment Method
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCryptoType("monero")}
              className={`p-3 rounded-lg border text-left transition-all ${
                cryptoType === "monero"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full bg-[#ff6600]" />
                <span className="text-sm font-medium text-white">Monero</span>
              </div>
              <div className="text-xs text-gray-400">Most private · XMR</div>
            </button>
            <button
              onClick={() => setCryptoType("ethereum")}
              className={`p-3 rounded-lg border text-left transition-all ${
                cryptoType === "ethereum"
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full bg-[#627eea]" />
                <span className="text-sm font-medium text-white">Ethereum</span>
              </div>
              <div className="text-xs text-gray-400">ETH Mainnet only</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 p-3 bg-[#ff6600]/5 border border-[#ff6600]/15 rounded-lg">
          <Shield className="h-4 w-4 text-[#ff6600] shrink-0" />
          <p className="text-xs text-gray-400">
            No account or KYC required. Your order is saved locally — no email needed to retrieve it.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full bg-[#ff6600] hover:bg-[#e55c00] text-white font-bold text-base"
          onClick={handleCreateOrder}
          disabled={creating}
        >
          {creating
            ? "Generating invoice..."
            : `Pay ${formatUsd(displayPrice)} in ${cryptoType === "monero" ? "Monero" : "Ethereum"}`}
        </Button>
      </div>

      {invoice && pkg && (
        <PaymentModal
          open={true}
          onClose={() => {
            setInvoice(null);
            router.push("/orders");
          }}
          invoiceId={invoice.invoiceId}
          packageName={pkg.name}
          packageCode={packageCode}
          amountUsd={invoice.amountUsd}
          amountCrypto={invoice.amountCrypto}
          cryptoType={cryptoType as "monero" | "ethereum"}
          paymentAddress={invoice.paymentAddress}
          qrCode={invoice.qrCode}
          paymentUrl={invoice.paymentUrl}
          expiresAt={invoice.expiresAt}
        />
      )}
    </div>
  );
}
