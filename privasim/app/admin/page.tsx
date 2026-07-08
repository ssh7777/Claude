"use client";

// Enterprise owner dashboard — everything in one place:
//  Overview   · wallet balance + backend orders
//  Analytics  · traffic + sales by source (which channel converts)
//  Coupons    · create / revoke / delete, with usage limits
//  Wallets    · update receiving XMR/ETH addresses (validated, no redeploy)
// All gated by the reseller API key.

import { useState } from "react";
import {
  LayoutDashboard, Loader2, RefreshCw, Wallet, BarChart3, Ticket, KeyRound, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "overview" | "analytics" | "coupons" | "wallets";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // data
  const [overview, setOverview] = useState<{ balanceUsd: number; summary: string | null } | null>(null);
  const [analytics, setAnalytics] = useState<{ sources: any[]; totals: any } | null>(null);
  const [coupons, setCoupons] = useState<{ code: string; uses: number; maxUses: number; revoked: boolean }[]>([]);
  const [wallets, setWallets] = useState<{ monero: string; ethereum: string; moneroSource: string; ethereumSource: string } | null>(null);

  const H = () => ({ "x-admin-key": key.trim(), "Content-Type": "application/json" });

  const unlock = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/orders", { headers: { "x-admin-key": key.trim() } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Wrong key");
      setOverview({ balanceUsd: j.balanceUsd, summary: j.summary });
      setUnlocked(true);
      loadAll();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const loadAll = async () => {
    fetch("/api/admin/analytics", { headers: H() }).then(r => r.json()).then(setAnalytics).catch(() => {});
    fetch("/api/admin/discounts", { headers: H() }).then(r => r.json()).then(j => setCoupons(j.coupons ?? [])).catch(() => {});
    fetch("/api/admin/settings", { headers: H() }).then(r => r.json()).then(setWallets).catch(() => {});
  };

  // coupon form
  const [cLabel, setCLabel] = useState("LAUNCH");
  const [cPct, setCPct] = useState("20");
  const [cDays, setCDays] = useState("30");
  const [cMax, setCMax] = useState("100");
  const [newCode, setNewCode] = useState("");

  const createCoupon = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST", headers: H(),
        body: JSON.stringify({ label: cLabel, percent: +cPct, validDays: +cDays, maxUses: +cMax || 0 }),
      });
      const j = await res.json();
      if (res.ok) { setNewCode(j.code); loadAll(); }
    } finally { setBusy(false); }
  };
  const patchCoupon = async (code: string, revoked: boolean) => {
    await fetch("/api/admin/discounts", { method: "PATCH", headers: H(), body: JSON.stringify({ code, revoked }) });
    loadAll();
  };
  const deleteCoupon = async (code: string) => {
    await fetch(`/api/admin/discounts?code=${encodeURIComponent(code)}`, { method: "DELETE", headers: H() });
    loadAll();
  };

  // wallets form
  const [xmr, setXmr] = useState("");
  const [eth, setEth] = useState("");
  const [walletMsg, setWalletMsg] = useState("");
  const saveWallets = async () => {
    setWalletMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: H(),
        body: JSON.stringify({ monero: xmr.trim() || undefined, ethereum: eth.trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setWallets(j.settings); setXmr(""); setEth(""); setWalletMsg("✓ Wallet addresses updated");
    } catch (e) { setWalletMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  if (!unlocked) {
    return (
      <div className="container py-12 max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <KeyRound className="h-7 w-7 text-[#ff6600]" />
          <h1 className="text-2xl font-black text-white">Owner Dashboard</h1>
        </div>
        <p className="text-sm text-gray-400 mb-3">Enter your reseller API key.</p>
        <div className="flex gap-2">
          <Input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder="pk_live_…" className="bg-white/10 border-white/20 text-white"
            onKeyDown={e => e.key === "Enter" && unlock()} />
          <Button onClick={unlock} disabled={busy} className="bg-[#ff6600] hover:bg-[#e55c00] text-white">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
        </div>
        {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "coupons", label: "Coupons", icon: Ticket },
    { id: "wallets", label: "Wallets", icon: Wallet },
  ];

  return (
    <div className="container py-12 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-7 w-7 text-[#ff6600]" />
          <h1 className="text-2xl font-black text-white">Owner Dashboard</h1>
        </div>
        <Button variant="outline" className="border-white/20 text-white" onClick={() => { unlock(); loadAll(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-[#ff6600] text-white" : "bg-white/5 text-gray-400 hover:text-white"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="space-y-4">
          <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
            <Wallet className="h-6 w-6 text-[#ff6600]" />
            <div>
              <div className="text-xs text-gray-400">Supplier wallet balance (funds purchases)</div>
              <div className="text-2xl font-black text-white">
                {overview.balanceUsd >= 0 ? `$${overview.balanceUsd.toFixed(2)}` : "—"}
              </div>
              {overview.balanceUsd >= 0 && overview.balanceUsd < 10 && (
                <div className="text-xs text-red-400 mt-1">⚠ Low — top up at pikasim.com/reseller/dashboard</div>
              )}
            </div>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="font-bold text-white mb-3">Backend orders (live)</h2>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">{overview.summary ?? "No orders yet."}</pre>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          {analytics?.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Visits", analytics.totals.visits],
                ["Checkouts", analytics.totals.checkouts],
                ["Sales", analytics.totals.sales],
                ["Revenue", `$${(analytics.totals.revenueUsd ?? 0).toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k as string} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs text-gray-400">{k}</div>
                  <div className="text-xl font-black text-white">{v}</div>
                </div>
              ))}
            </div>
          )}
          <div className="p-5 bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
            <h2 className="font-bold text-white mb-3">Traffic &amp; sales by source</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-left">
                <th className="pb-2">Source</th><th className="pb-2">Visits</th><th className="pb-2">Sales</th>
                <th className="pb-2">Revenue</th><th className="pb-2">Conv.</th>
              </tr></thead>
              <tbody>
                {(analytics?.sources ?? []).map((s: any) => (
                  <tr key={s.source} className="border-t border-white/5">
                    <td className="py-2 text-white font-medium">{s.source}</td>
                    <td className="py-2 text-gray-300">{s.visits}</td>
                    <td className="py-2 text-gray-300">{s.sales}</td>
                    <td className="py-2 text-green-400">${s.revenueUsd.toFixed(2)}</td>
                    <td className="py-2 text-gray-300">{s.convRate}%</td>
                  </tr>
                ))}
                {(!analytics?.sources || analytics.sources.length === 0) && (
                  <tr><td colSpan={5} className="py-4 text-gray-500 text-center">No traffic recorded yet.</td></tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3">
              Tag your marketing links with <code className="text-gray-300">?utm_source=reddit</code> etc. so each channel is attributed.
            </p>
          </div>
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-4">
          <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="font-bold text-white mb-3">Create coupon</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <Input value={cLabel} onChange={e => setCLabel(e.target.value)} placeholder="Label" className="bg-white/10 border-white/20 text-white text-sm" />
              <Input type="number" value={cPct} onChange={e => setCPct(e.target.value)} placeholder="% off" className="bg-white/10 border-white/20 text-white text-sm" />
              <Input type="number" value={cDays} onChange={e => setCDays(e.target.value)} placeholder="Days valid" className="bg-white/10 border-white/20 text-white text-sm" />
              <Input type="number" value={cMax} onChange={e => setCMax(e.target.value)} placeholder="Max uses (0=∞)" className="bg-white/10 border-white/20 text-white text-sm" />
            </div>
            <Button onClick={createCoupon} disabled={busy} className="bg-[#ff6600] hover:bg-[#e55c00] text-white">Generate</Button>
            {newCode && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <code className="text-green-300 text-sm break-all cursor-pointer" onClick={() => navigator.clipboard.writeText(newCode)}>{newCode}</code>
                <p className="text-xs text-gray-400 mt-1">Click to copy.</p>
              </div>
            )}
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="font-bold text-white mb-3">Active coupons</h2>
            <div className="space-y-1.5">
              {coupons.map(c => (
                <div key={c.code} className="flex items-center justify-between gap-2 text-xs bg-white/3 rounded px-2 py-1.5">
                  <code className={c.revoked ? "text-gray-500 line-through" : "text-gray-200"}>{c.code}</code>
                  <span className="text-gray-400 shrink-0">{c.uses}/{c.maxUses || "∞"}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => patchCoupon(c.code, !c.revoked)} className={`px-2 py-0.5 rounded ${c.revoked ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>{c.revoked ? "Enable" : "Revoke"}</button>
                    <button onClick={() => deleteCoupon(c.code)} className="px-2 py-0.5 rounded bg-red-500/20 text-red-300">Delete</button>
                  </div>
                </div>
              ))}
              {coupons.length === 0 && <p className="text-xs text-gray-500">No coupons yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "wallets" && (
        <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-4">
          <div>
            <h2 className="font-bold text-white mb-1">Receiving wallets</h2>
            <p className="text-xs text-gray-400">Update the addresses customer payments go to. Validated and effective immediately — no redeploy.</p>
          </div>
          {wallets && (
            <div className="text-xs text-gray-400 space-y-1">
              <div>Monero (<span className={wallets.moneroSource === "custom" ? "text-green-400" : "text-gray-500"}>{wallets.moneroSource}</span>): <code className="text-gray-300 break-all">{wallets.monero}</code></div>
              <div>Ethereum (<span className={wallets.ethereumSource === "custom" ? "text-green-400" : "text-gray-500"}>{wallets.ethereumSource}</span>): <code className="text-gray-300 break-all">{wallets.ethereum}</code></div>
            </div>
          )}
          <div className="space-y-2">
            <Input value={xmr} onChange={e => setXmr(e.target.value)} placeholder="New Monero address (4… or 8…)" className="bg-white/10 border-white/20 text-white text-sm" />
            <Input value={eth} onChange={e => setEth(e.target.value)} placeholder="New Ethereum address (0x…)" className="bg-white/10 border-white/20 text-white text-sm" />
          </div>
          <Button onClick={saveWallets} disabled={busy || (!xmr.trim() && !eth.trim())} className="bg-[#ff6600] hover:bg-[#e55c00] text-white">
            <Save className="h-4 w-4 mr-2" /> Save wallets
          </Button>
          {walletMsg && <p className={`text-xs ${walletMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{walletMsg}</p>}
          <div className="text-xs text-yellow-300/80 bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
            ⚠ Double-check every character. Funds sent to a wrong address are unrecoverable.
          </div>
        </div>
      )}
    </div>
  );
}
