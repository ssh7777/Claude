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

  // Discount code generator
  const [dLabel, setDLabel] = useState("LAUNCH");
  const [dPercent, setDPercent] = useState("20");
  const [dDays, setDDays] = useState("30");
  const [genCode, setGenCode] = useState("");
  const [genError, setGenError] = useState("");
  const [genBusy, setGenBusy] = useState(false);

  const generateCode = async () => {
    setGenBusy(true);
    setGenError("");
    setGenCode("");
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key.trim() },
        body: JSON.stringify({
          label: dLabel,
          percent: Number(dPercent),
          validDays: Number(dDays),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setGenCode(j.code);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenBusy(false);
    }
  };

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
            <h2 className="font-bold text-white mb-1">Discount codes</h2>
            <p className="text-xs text-gray-400 mb-3">
              Codes are cryptographically signed — nobody can forge or alter them. Max 50% off,
              expiry enforced server-side. Share them anywhere for marketing.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Input
                value={dLabel}
                onChange={(e) => setDLabel(e.target.value)}
                placeholder="Label (LAUNCH)"
                className="bg-white/10 border-white/20 text-white text-sm"
              />
              <Input
                type="number"
                value={dPercent}
                onChange={(e) => setDPercent(e.target.value)}
                placeholder="% off (1–50)"
                className="bg-white/10 border-white/20 text-white text-sm"
              />
              <Input
                type="number"
                value={dDays}
                onChange={(e) => setDDays(e.target.value)}
                placeholder="Valid days"
                className="bg-white/10 border-white/20 text-white text-sm"
              />
            </div>
            <Button
              onClick={generateCode}
              disabled={genBusy}
              className="bg-[#ff6600] hover:bg-[#e55c00] text-white"
            >
              {genBusy ? "Generating…" : "Generate code"}
            </Button>
            {genCode && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <code
                  className="text-green-300 text-sm break-all cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(genCode)}
                  title="Click to copy"
                >
                  {genCode}
                </code>
                <p className="text-xs text-gray-400 mt-1">Click to copy. Customers enter it at checkout.</p>
              </div>
            )}
            {genError && <p className="text-xs text-red-400 mt-2">{genError}</p>}
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
