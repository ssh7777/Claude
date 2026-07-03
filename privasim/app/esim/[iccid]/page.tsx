"use client";

// Branded eSIM status & usage tracker — fully first-party, no vendor
// links or logos. Data comes from our backend via /api/esim/status.

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Wifi,
  RefreshCw,
  Clock,
  BatteryCharging,
  BookOpen,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EsimStatus {
  status: string;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
  summary?: string;
}

export default function EsimTrackerPage() {
  const params = useParams<{ iccid: string }>();
  const iccid = String(params.iccid ?? "");
  const [data, setData] = useState<EsimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/esim/status?iccid=${encodeURIComponent(iccid)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to load status");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [iccid]);

  useEffect(() => {
    if (iccid) load();
  }, [iccid, load]);

  const total = (data?.dataUsedGb ?? 0) + (data?.dataRemainingGb ?? 0);
  const usedPct = total > 0 ? Math.min(100, Math.round(((data?.dataUsedGb ?? 0) / total) * 100)) : 0;
  const statusColor =
    data?.status === "active" ? "text-green-400" :
    data?.status === "expired" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="container py-12 max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-[#ff6600] flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">My eSIM</h1>
          <p className="text-xs text-gray-400 font-mono break-all">{iccid}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 text-[#ff6600] animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Checking live status…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <Button variant="outline" className="border-white/20 text-white" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-400">Status</span>
              <span className={`font-bold uppercase text-sm ${statusColor}`}>{data.status}</span>
            </div>

            {total > 0 && (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Wifi className="h-4 w-4 text-[#ff6600]" /> Data usage
                  </span>
                  <span className="text-white font-medium">
                    {data.dataUsedGb.toFixed(2)} GB used · {data.dataRemainingGb.toFixed(2)} GB left
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-6">
                  <div
                    className={`h-full rounded-full transition-all ${usedPct > 85 ? "bg-red-500" : usedPct > 60 ? "bg-yellow-500" : "bg-[#ff6600]"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </>
            )}

            {data.expiresAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Expires
                </span>
                <span className="text-white">{data.expiresAt.slice(0, 10)}</span>
              </div>
            )}

            {!total && data.summary && (
              <pre className="text-xs text-gray-400 whitespace-pre-wrap mt-4">{data.summary}</pre>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="border-white/20 text-white" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-[#ff6600] hover:bg-[#e55c00] text-white" asChild>
              <Link href={`/topup?iccid=${encodeURIComponent(iccid)}`}>
                <BatteryCharging className="h-4 w-4 mr-2" />
                Top up data
              </Link>
            </Button>
            <Button variant="outline" className="border-white/20 text-white" asChild>
              <Link href="/guide">
                <BookOpen className="h-4 w-4 mr-2" />
                Install guide
              </Link>
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Live usage data updates from the carrier every few minutes. Bookmark this page to
            check your eSIM anytime — no account needed.
          </p>
        </div>
      ) : null}
    </div>
  );
}
