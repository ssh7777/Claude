"use client";

// Owner dashboard — live sync of backend orders, transactions, and wallet
// balance. Requires the reseller API key; nothing here is public.

import { useState } from "react";
import { LayoutDashboard, Loader2, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    balanceUsd: number;
    orders: unknown[];
    summary: string | null;
  } | null>(null);

  const load = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { "x-admin-key": key.trim() },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-12 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="h-7 w-7 text-[#ff6600]" />
        <h1 className="text-2xl font-black text-white">Owner Dashboard</h1>
      </div>

      {!data ? (
        <div className="max-w-md">
          <p className="text-sm text-gray-400 mb-3">
            Enter your reseller API key to sync live orders, transactions, and balance.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="pk_live_…"
              className="bg-white/10 border-white/20 text-white"
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <Button onClick={load} disabled={loading} className="bg-[#ff6600] hover:bg-[#e55c00] text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-[#ff6600]" />
              <div>
                <div className="text-xs text-gray-400">Wallet balance (funds purchases)</div>
                <div className="text-2xl font-black text-white">
                  {data.balanceUsd >= 0 ? `$${data.balanceUsd.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>
            <Button variant="outline" className="border-white/20 text-white" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="font-bold text-white mb-3">Backend orders (live)</h2>
            {data.summary ? (
              <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">{data.summary}</pre>
            ) : (
              <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(data.orders, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
